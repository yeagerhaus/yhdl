import { Deezer, TrackFormats, type DiscographyAlbum } from "../deezer/index.js";
import { Downloader, type DownloadResult } from "../downloader/index.js";
import {
	resolveArtistReleases,
	createReleaseFolders,
	findOrCreateArtistFolder,
	getExistingReleases,
	type ResolvedRelease,
} from "../folder-resolver.js";
import { scanLibrary, normalizeArtistName } from "../library/scanner.js";
import type { LibraryArtist, ScanProgress } from "../library/types.js";
import {
	loadState,
	saveState,
	updateArtistCheck,
	updateArtistLastRelease,
	shouldSkipArtist,
	updateLastFullSync,
	cacheLibraryScan,
	getCachedLibraryScan,
	cacheArtistReleases,
	getCachedArtistReleases,
	isArtistIgnored,
} from "./state.js";
import type { SyncState } from "./types.js";
import {
	logSyncStart,
	logArtistCheck,
	logSyncComplete,
	logArtistCheckError,
	logProgress,
	writeFailureLog,
	type SyncSummary,
} from "./logger.js";
import type { Config } from "../config.js";
import cliProgress from "cli-progress";
import pc from "picocolors";
import path from "path";

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export interface SyncOptions {
	musicRootPath: string;
	bitrate?: number;
	concurrency?: number;
	checkIntervalHours?: number;
	fullSync?: boolean;
	dryRun?: boolean;
	statePath?: string;
	errorLogPath?: string;
	specificArtist?: string; // If provided, only sync this artist
	deezerArl?: string; // Override ARL from config
}

export interface SyncResult {
	summary: SyncSummary;
	artistsChecked: number;
	artistsSkipped: number;
	newReleases: number;
	downloadResults: DownloadResult[];
	errors: Array<{ artist: string; error: string }>;
}

export interface NewRelease {
	release: ResolvedRelease;
	artistName: string;
	artistId: number;
}

/**
 * Check a single artist for new releases
 */
async function checkArtistForNewReleases(
	dz: Deezer,
	artistName: string,
	artistId: number,
	musicRootPath: string,
	cachedExistingReleases?: string[] | null
): Promise<{ newReleases: ResolvedRelease[]; error?: string }> {
	try {
		// Get discography from Deezer
		const discography = await dz.gw.get_artist_discography_tabs(artistId, { limit: 100 });
		const allReleases: DiscographyAlbum[] = discography.all || [];

		if (allReleases.length === 0) {
			return { newReleases: [] };
		}

		// Resolve releases and check which ones exist
		// If we have cached releases, we can optimize the check
		const resolved = resolveArtistReleases(musicRootPath, artistName, artistId, allReleases, cachedExistingReleases);
		const newReleases = resolved.filter((r) => !r.exists);

		return { newReleases };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { newReleases: [], error: errorMessage };
	}
}

/**
 * Download a single release
 */
async function downloadRelease(
	dz: Deezer,
	release: ResolvedRelease,
	bitrate: number,
	dryRun: boolean,
	onReleaseStart?: (release: ResolvedRelease, index: number, total: number) => void,
	onReleaseComplete?: (release: ResolvedRelease, results: DownloadResult[]) => void,
	onTrackStart?: (track: { title: string; id: number }, index: number, total: number) => void,
	onTrackProgress?: (progress: { downloaded: number; total: number; trackTitle: string }) => void,
	onTrackComplete?: (result: DownloadResult, index: number, total: number) => void
): Promise<DownloadResult[]> {
	if (dryRun) {
		// Return mock results for dry run
		return release.album.nb_tracks
			? Array.from({ length: release.album.nb_tracks }, (_, i) => ({
					success: true,
					trackId: 0,
					trackTitle: `Track ${i + 1}`,
					filePath: `${release.folderPath}/track-${i + 1}`,
				}))
			: [];
	}

	// Create folders
	createReleaseFolders([release]);

	// Download
	const downloader = new Downloader(dz, {
		bitrate,
		downloadPath: release.folderPath,
		releaseType: release.releaseType,
		onTrackStart: (trackInfo, index, total) => {
			if (onTrackStart) {
				onTrackStart({ title: trackInfo.title, id: trackInfo.id }, index, total);
			}
		},
		onTrackComplete: (result, index, total) => {
			if (onTrackComplete) {
				onTrackComplete(result, index, total);
			}
		},
		onProgress: (progress) => {
			if (onTrackProgress) {
				onTrackProgress({
					downloaded: progress.downloaded,
					total: progress.total,
					trackTitle: progress.trackTitle,
				});
			}
		},
	});

	const results = await downloader.downloadAlbum(release.album.id, release.album.title);
	
	if (onReleaseComplete) {
		onReleaseComplete(release, results);
	}

	return results;
}

/**
 * Process a batch of artists with concurrency control
 */
async function processArtistsBatch<T, R>(
	items: T[],
	concurrency: number,
	processor: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = [];
	const executing: Promise<void>[] = [];

	for (const item of items) {
		const promise = processor(item).then((result) => {
			results.push(result);
		});

		executing.push(promise);

		if (executing.length >= concurrency) {
			await Promise.race(executing);
			executing.splice(
				executing.findIndex((p) => p === promise),
				1
			);
		}
	}

	await Promise.all(executing);
	return results;
}

/**
 * Find artist ID by name using Deezer search
 */
async function findArtistId(dz: Deezer, artistName: string): Promise<number | null> {
	try {
		const searchResults = await dz.api.search_artist(artistName, { limit: 1 });
		if (searchResults.data && searchResults.data.length > 0) {
			return searchResults.data[0].id;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Main sync function - sync entire library
 */
export async function syncLibrary(options: SyncOptions): Promise<SyncResult> {
	const startTime = Date.now();
	const {
		musicRootPath,
		bitrate = TrackFormats.FLAC,
		concurrency = 5,
		checkIntervalHours = 24,
		fullSync = false,
		dryRun = false,
		specificArtist,
	} = options;

	const statePath = options.statePath || ".yhdl/sync-state.json";
	const errorLogPath = options.errorLogPath || ".yhdl/sync-errors.json";

	// Load state
	const state = loadState(statePath);

	// Initialize Deezer
	const dz = new Deezer();

	// Login (ARL from options, config, or .env)
	const { loadArl } = await import("../config.js");
	const arl = options.deezerArl || loadArl();
	if (!arl) {
		throw new Error("DEEZER_ARL not found. Provide it via options.deezerArl, setConfig(), or DEEZER_ARL environment variable.");
	}

	const loggedIn = await dz.loginViaArl(arl);
	if (!loggedIn) {
		throw new Error("Failed to login to Deezer. Check your ARL token.");
	}

	logSyncStart({
		musicRootPath,
		concurrency,
		fullSync,
	});

	// Scan library or use specific artist
	let libraryArtists: LibraryArtist[];
	if (specificArtist) {
		// Single artist mode
		libraryArtists = [
			{
				name: specificArtist,
				path: findOrCreateArtistFolder(musicRootPath, specificArtist),
				source: "folder",
			},
		];
	} else {
		// Check if we have a cached library scan (valid for 24 hours)
		const cachedScan = getCachedLibraryScan(state, musicRootPath, 24);
		
		if (cachedScan && !fullSync) {
			// Use cached library scan - much faster!
			console.log(`  Using cached library scan (from ${new Date(cachedScan.lastScanned).toLocaleString()})`);
			libraryArtists = cachedScan.artists.map((a) => ({
				name: a.name,
				path: a.path,
				source: "folder" as const,
			}));
			console.log();
			console.log(`  Found ${libraryArtists.length} artist(s) in library (cached)`);
			console.log();
		} else {
			// Scan entire library with progress bar
			console.log("  Scanning library for artists...");
			if (cachedScan) {
				console.log("  (Cache expired or full sync requested - rescanning)");
			}
			console.log();

			// Create progress bar for scanning
			const scanProgressBar = new cliProgress.SingleBar({
				format: pc.dim("  │ ") + pc.cyan("{bar}") + pc.dim(" │ ") + pc.white("{percentage}%") + pc.dim(" │ ") + pc.yellow("{value}") + pc.dim(" artists found") + pc.dim(" │ ") + pc.dim("{message}"),
				barCompleteChar: "█",
				barIncompleteChar: "░",
				hideCursor: true,
				clearOnComplete: false,
				barsize: 30,
			});

			let lastProgress: ScanProgress = {
				artistsFound: 0,
				directoriesScanned: 0,
				filesProcessed: 0,
			};

			// Start progress bar (we'll update it as we go)
			scanProgressBar.start(100, 0, { message: "Starting scan..." });

			libraryArtists = await scanLibrary(musicRootPath, {
				includeMetadata: false, // Skip metadata - folder-based is much faster and sufficient
				includeFolders: true,
				onProgress: (progress: ScanProgress) => {
					lastProgress = progress;
					// Simple progress: show artists found, percentage based on directories scanned
					// Since we're only doing folder scanning, this is fast and we can estimate progress
					const percentage = Math.min(95, Math.round((progress.directoriesScanned / Math.max(progress.directoriesScanned, 1)) * 90));

					const message = progress.currentPath
						? path.basename(progress.currentPath).slice(0, 30)
						: "Scanning folders...";

					scanProgressBar.update(percentage, {
						value: progress.artistsFound,
						message: message,
					});
				},
			});

			// Complete the progress bar
			scanProgressBar.update(100, {
				value: libraryArtists.length,
				message: "Complete",
			});
			scanProgressBar.stop();

			// Cache the library scan results
			cacheLibraryScan(
				state,
				musicRootPath,
				libraryArtists.map((a) => ({ name: a.name, path: a.path }))
			);

			console.log(`  Found ${libraryArtists.length} artist(s) in library`);
			console.log();
		}
	}

	const totalArtists = libraryArtists.length;

	// Filter out ignored artists
	const ignoredCount = libraryArtists.filter((a) => isArtistIgnored(state, a.name)).length;
	const artistsToProcess = libraryArtists.filter((a) => !isArtistIgnored(state, a.name));
	const ignoredArtistsCount = totalArtists - artistsToProcess.length;
	let checkedArtists = 0;
	let skippedArtists = 0;
	let newReleasesCount = 0;
	const allDownloadResults: DownloadResult[] = [];
	const errors: Array<{ artist: string; error: string }> = [];
	
	if (ignoredCount > 0) {
		console.log(`  Skipping ${ignoredCount} ignored artist(s)`);
		console.log();
	}

	// Create progress bar for artist checking (only if multiple artists)
	let artistProgressBar: cliProgress.SingleBar | null = null;
	if (artistsToProcess.length > 1) {
		artistProgressBar = new cliProgress.SingleBar({
			format: pc.dim("  │ ") + pc.cyan("{bar}") + pc.dim(" │ ") + pc.white("{percentage}%") + pc.dim(" │ ") + pc.yellow("{value}") + pc.dim("/") + pc.yellow("{total}") + pc.dim(" artists") + pc.dim(" │ ") + pc.dim("{message}"),
			barCompleteChar: "█",
			barIncompleteChar: "░",
			hideCursor: true,
			clearOnComplete: false,
			barsize: 30,
		});
		artistProgressBar.start(artistsToProcess.length, 0, { message: "Checking artists..." });
	}

	// Track active downloads for single artist mode
	let activeReleaseIndex = 0;
	let activeTrackIndex = 0;
	let activeTrackTotal = 0;
	let activeReleaseTitle = "";
	let activeTrackTitle = "";
	const progressBars: {
		track: cliProgress.SingleBar | null;
		release: cliProgress.SingleBar | null;
	} = {
		track: null,
		release: null,
	};

	// Process artists in batches
	const artistResults = await processArtistsBatch(
		artistsToProcess,
		concurrency,
		async (libraryArtist) => {
			const normalizedName = normalizeArtistName(libraryArtist.name);

			// Find artist ID
			const artistId = await findArtistId(dz, libraryArtist.name);
			if (!artistId) {
				const error = `Artist not found on Deezer: ${libraryArtist.name}`;
				errors.push({ artist: libraryArtist.name, error });
				logArtistCheckError(libraryArtist.name, error);
				writeFailureLog(errorLogPath, {
					artist: libraryArtist.name,
					error,
					type: "artist_check",
				});
				return;
			}

			// Check if should skip
			if (!fullSync && shouldSkipArtist(state, artistId, checkIntervalHours)) {
				skippedArtists++;
				logArtistCheck(libraryArtist.name, artistId, 0, true);
				return;
			}

			// Check for new releases (use cached existing releases if available)
			const cachedReleases = getCachedArtistReleases(state, artistId);
			const { newReleases, error } = await checkArtistForNewReleases(
				dz,
				libraryArtist.name,
				artistId,
				musicRootPath,
				cachedReleases
			);
			
			// Cache the existing releases for this artist (if we got them fresh)
			if (!cachedReleases && !error) {
				const artistPath = findOrCreateArtistFolder(musicRootPath, libraryArtist.name);
				const existingFolders = getExistingReleases(artistPath);
				cacheArtistReleases(state, artistId, existingFolders);
			}

			if (error) {
				errors.push({ artist: libraryArtist.name, error });
				logArtistCheckError(libraryArtist.name, error);
				writeFailureLog(errorLogPath, {
					artist: libraryArtist.name,
					artistId,
					error,
					type: "artist_check",
				});
				return;
			}

			checkedArtists++;
			newReleasesCount += newReleases.length;

			logArtistCheck(libraryArtist.name, artistId, newReleases.length, false);

			// Update progress bar for artist checking
			if (artistProgressBar) {
				artistProgressBar.update(checkedArtists + skippedArtists, {
					message: libraryArtist.name.slice(0, 30),
				});
			}

			// Update state
			updateArtistCheck(state, artistId, libraryArtist.name);

			// Download new releases
			if (newReleases.length > 0 && !dryRun) {
				// Create release progress bar for single artist mode
				if (specificArtist && newReleases.length > 1) {
					console.log(); // Add spacing before progress bar
					progressBars.release = new cliProgress.SingleBar({
						format: pc.dim("  │ ") + pc.magenta("{bar}") + pc.dim(" │ ") + pc.white("{percentage}%") + pc.dim(" │ ") + pc.yellow("{value}") + pc.dim("/") + pc.yellow("{total}") + pc.dim(" releases") + pc.dim(" │ ") + pc.cyan("{message}"),
						barCompleteChar: "█",
						barIncompleteChar: "░",
						hideCursor: true,
						clearOnComplete: true,
						barsize: 30,
					});
					// progressBars.release.start(newReleases.length, 0, { message: "Starting downloads..." });
				}
			}

					for (let releaseIdx = 0; releaseIdx < newReleases.length; releaseIdx++) {
				const release = newReleases[releaseIdx];
				const currentReleaseIdx = releaseIdx; // Capture for closure
				activeReleaseIndex = releaseIdx;
				activeReleaseTitle = release.album.title;

				try {
					// Log release start for single artist mode
					if (specificArtist && newReleases.length > 0) {
						if (releaseIdx > 0) {
							console.log(); // Add spacing between releases
						}
						console.log(pc.cyan(`  📀 Downloading: ${release.album.title}`));
						if (release.album.release_date) {
							console.log(pc.dim(`     Release Date: ${release.album.release_date}`));
						}
					}

					const results = await downloadRelease(
						dz,
						release,
						bitrate,
						dryRun,
						// onReleaseStart
						(release, index, total) => {
							if (specificArtist) {
								activeReleaseIndex = index - 1; // Convert to 0-based
								activeReleaseTitle = release.album.title;
							}
						},
						// onReleaseComplete
						(release, results) => {
							// Update release progress bar (1-based for display)
							if (progressBars.release) {
								progressBars.release.update(currentReleaseIdx + 1, {
									message: release.album.title.slice(0, 30),
								});
							}
							// Stop track progress bar when release completes
							if (progressBars.track) {
								progressBars.track.stop();
								progressBars.track = null;
							}
							if (specificArtist) {
								const successCount = results.filter((r) => r.success).length;
								const failCount = results.filter((r) => !r.success).length;
								console.log(pc.green(`  ✓ Completed: ${release.album.title} (${successCount} tracks${failCount > 0 ? `, ${failCount} failed` : ""})`));
							}
						},
						// onTrackStart
						(track, index, total) => {
							activeTrackIndex = index;
							activeTrackTotal = total;
							activeTrackTitle = track.title;
							
							if (specificArtist) {
								// Create track progress bar on first track of release
								if (index === 1) {
									if (progressBars.track) {
										progressBars.track.stop();
									}
									progressBars.track = new cliProgress.SingleBar({
										format: pc.dim("    │ ") + pc.green("{bar}") + pc.dim(" │ ") + pc.white("{percentage}%") + pc.dim(" │ ") + pc.yellow("{value}") + pc.dim("/") + pc.yellow("{total}") + pc.dim(" tracks") + pc.dim(" │ ") + pc.cyan("{message}"),
										barCompleteChar: "█",
										barIncompleteChar: "░",
										hideCursor: true,
										clearOnComplete: true,
										barsize: 25,
									});
									progressBars.track.start(total, 0, { message: track.title.slice(0, 40) });
								} else if (progressBars.track) {
									// Update track number for subsequent tracks
									progressBars.track.update(index - 1, {
										message: track.title.slice(0, 40),
									});
								}
							}
						},
						// onTrackProgress
						(progress) => {
							if (progressBars.track && specificArtist) {
								// Show download progress for current track in the message
								// Keep the track number in the bar, show download progress in message
								const downloadPercent = progress.total > 0 
									? Math.round((progress.downloaded / progress.total) * 100) 
									: 0;
								progressBars.track.update(activeTrackIndex - 1, {
									message: `${progress.trackTitle.slice(0, 30)} (${downloadPercent}% - ${formatBytes(progress.downloaded)}/${formatBytes(progress.total)})`,
								});
							}
						},
						// onTrackComplete
						(result, index, total) => {
							activeTrackIndex = index;
							if (progressBars.track && specificArtist) {
								// Update progress bar to show completed track (0-based index)
								progressBars.track.update(index - 1, {
									message: result.trackTitle.slice(0, 40),
								});
								// Don't stop here - let onReleaseComplete handle it for cleaner output
							}
							if (specificArtist && !result.success) {
								console.log(pc.red(`    ✗ ${result.trackTitle}: ${result.error || "Failed"}`));
							}
						}
					);
					allDownloadResults.push(...results);

					// Log failures
					for (const result of results) {
						if (!result.success && result.error) {
							writeFailureLog(errorLogPath, {
								artist: libraryArtist.name,
								artistId,
								release: release.album.title,
								releaseId: release.album.id,
								error: result.error,
								type: "track_download",
							});
						}
					}

					// Update last release date if successful
					if (release.album.release_date) {
						updateArtistLastRelease(state, artistId, release.album.release_date);
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					errors.push({
						artist: libraryArtist.name,
						error: `Failed to download ${release.album.title}: ${errorMessage}`,
					});
					writeFailureLog(errorLogPath, {
						artist: libraryArtist.name,
						artistId,
						release: release.album.title,
						releaseId: release.album.id,
						error: errorMessage,
						type: "release_download",
					});
				}
			}
		}
	);

	// Clean up progress bars
	if (artistProgressBar) {
		artistProgressBar.update(artistsToProcess.length, { message: "Complete" });
		artistProgressBar.stop();
		console.log();
	}
	// Release progress bar - ensure it shows completion
	if (progressBars.release) {
		// The progress bar should already be at the final count from onReleaseComplete callbacks
		// But ensure it's at 100% if we completed all releases
		progressBars.release.stop();
	}
	// Track progress bar should already be stopped, but ensure cleanup
	if (progressBars.track) {
		progressBars.track.stop();
	}

	// Update last full sync
	if (!specificArtist) {
		updateLastFullSync(state);
	}

	// Save state
	saveState(statePath, state);

	// Calculate summary
	const successfulDownloads = allDownloadResults.filter((r) => r.success).length;
	const failedDownloads = allDownloadResults.filter((r) => !r.success).length;
	const duration = Date.now() - startTime;

	const summary: SyncSummary = {
		totalArtists,
		checkedArtists,
		skippedArtists: skippedArtists + ignoredArtistsCount,
		newReleases: newReleasesCount,
		downloadedTracks: successfulDownloads,
		failedTracks: failedDownloads,
		duration,
	};

	logSyncComplete(summary);

	return {
		summary,
		artistsChecked: checkedArtists,
		artistsSkipped: skippedArtists,
		newReleases: newReleasesCount,
		downloadResults: allDownloadResults,
		errors,
	};
}

/**
 * Check a single artist (convenience function)
 */
export async function checkArtist(
	dz: Deezer,
	artistName: string,
	artistId: number,
	musicRootPath: string
): Promise<ResolvedRelease[]> {
	const { newReleases } = await checkArtistForNewReleases(dz, artistName, artistId, musicRootPath);
	return newReleases;
}

