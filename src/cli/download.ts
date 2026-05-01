#!/usr/bin/env node

import fs from "node:fs";
import ora from "ora";
import pc from "picocolors";
import { downloadTrack as downloadTrackAPI } from "../api/download.js";
import { getEnvPathForDisplay, loadConfig } from "../config.js";
import {
	Deezer,
	type DiscographyAlbum,
	TrackFormats,
} from "../deezer/index.js";
import { Downloader, type DownloadResult } from "../downloader/index.js";
import {
	createReleaseFolders,
	resolveArtistReleases,
} from "../folder-resolver.js";
import { parseBitrate } from "../utils.js";
import { loginWithPrompt } from "./auth.js";
import { createBar } from "./progress.js";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function printHeader() {
	console.log();
	console.log(pc.bold(pc.magenta("  ╭─────────────────────────────────╮")));
	console.log(
		pc.bold(pc.magenta("  │")) +
			pc.bold(pc.white("    🎵 yhdl • Artist Downloader   ")) +
			pc.bold(pc.magenta("│")),
	);
	console.log(pc.bold(pc.magenta("  ╰─────────────────────────────────╯")));
	console.log();
}

function printConfig(musicRoot: string, configPath: string) {
	console.log(pc.dim("  ┌─ Config ─────────────────────────────────"));
	console.log(pc.dim("  │ ") + pc.cyan("Music root: ") + pc.white(musicRoot));
	console.log(pc.dim("  │ ") + pc.cyan("Config:     ") + pc.dim(configPath));
	console.log(pc.dim("  └────────────────────────────────────────────"));
	console.log();
}

function printSummary(downloaded: number, skipped: number, failed: number) {
	console.log();
	console.log(pc.bold(pc.white("  ╭─────────────────────────────────╮")));
	console.log(
		pc.bold(pc.white("  │")) +
			pc.bold("         📊 Summary               ") +
			pc.bold(pc.white("│")),
	);
	console.log(pc.bold(pc.white("  ├─────────────────────────────────┤")));
	console.log(
		pc.bold(pc.white("  │")) +
			pc.green(
				` ✓ Downloaded: ${String(downloaded).padStart(4)} tracks       `,
			) +
			pc.bold(pc.white("│")),
	);
	console.log(
		pc.bold(pc.white("  │")) +
			pc.blue(` ○ Skipped:    ${String(skipped).padStart(4)} releases      `) +
			pc.bold(pc.white("│")),
	);
	if (failed > 0) {
		console.log(
			pc.bold(pc.white("  │")) +
				pc.red(` ✗ Failed:     ${String(failed).padStart(4)} tracks        `) +
				pc.bold(pc.white("│")),
		);
	}
	console.log(pc.bold(pc.white("  ╰─────────────────────────────────╯")));
	console.log();
}

function createProgressBar() {
	return createBar(
		pc.dim("  │ ") + pc.cyan("{bar}") + pc.dim(" │ ") + pc.white("{percentage}%") + pc.dim(" │ ") + pc.dim("{value}/{total} tracks"),
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export async function downloadArtist(
	artistQuery: string,
	opts: { bitrate: string; dryRun?: boolean },
) {
	const bitrate = parseBitrate(opts.bitrate);

	printHeader();

	// Load config
	const config = loadConfig();
	printConfig(config.musicRootPath, getEnvPathForDisplay());

	// Initialize Deezer and login
	const dz = new Deezer();
	await loginWithPrompt(dz);

	// Check subscription
	if (bitrate === TrackFormats.FLAC && !dz.currentUser?.can_stream_lossless) {
		console.log(
			pc.yellow(
				"  ⚠ Your account doesn't support FLAC. Falling back to MP3 320.",
			),
		);
	}

	// ===== PHASE 1: SEARCH =====
	const searchSpinner = ora({
		text: `Searching for "${pc.bold(artistQuery)}"...`,
		prefixText: " ",
		color: "cyan",
	}).start();

	const searchResults = await dz.api.search_artist(artistQuery, { limit: 5 });

	if (!searchResults.data.length) {
		searchSpinner.fail(pc.red(`No artists found for "${artistQuery}"`));
		process.exit(1);
	}

	const artist = searchResults.data[0];
	searchSpinner.succeed(
		`Found ${pc.bold(pc.magenta(artist.name))} ${pc.dim(`(ID: ${artist.id})`)}`,
	);

	// ===== PHASE 2: FETCH DISCOGRAPHY =====
	const discogSpinner = ora({
		text: "Fetching discography...",
		prefixText: " ",
		color: "cyan",
	}).start();

	const discography = await dz.gw.get_artist_discography_tabs(artist.id, {
		limit: 100,
	});
	const allReleases: DiscographyAlbum[] = discography.all || [];

	if (allReleases.length === 0) {
		discogSpinner.warn(pc.yellow("No releases found for this artist."));
		process.exit(0);
	}

	discogSpinner.succeed(
		`Found ${pc.bold(pc.cyan(String(allReleases.length)))} releases`,
	);

	// ===== PHASE 3: RESOLVE FOLDERS =====
	const resolveSpinner = ora({
		text: "Analyzing library...",
		prefixText: " ",
		color: "cyan",
	}).start();

	const resolvedReleases = resolveArtistReleases(
		config.musicRootPath,
		artist.name,
		artist.id,
		allReleases,
	);

	const existingReleases = resolvedReleases.filter((r) => r.exists);
	const newReleases = resolvedReleases.filter((r) => !r.exists);

	resolveSpinner.succeed(
		`${pc.green(String(existingReleases.length))} existing, ${pc.cyan(String(newReleases.length))} to download`,
	);

	// Show releases
	console.log();
	console.log(pc.dim("  ┌─ Releases ──────────────────────────────────"));
	for (const release of resolvedReleases) {
		const icon = release.exists ? pc.green("✓") : pc.cyan("→");
		const title = release.exists
			? pc.dim(release.album.title)
			: pc.white(release.album.title);
		const type = pc.dim(`[${release.releaseType}]`);
		const status = release.exists ? pc.dim("exists") : pc.cyan("new");
		console.log(`${pc.dim("  │ ")}${icon} ${title} ${type} ${status}`);
	}
	console.log(pc.dim("  └───────────────────────────────────────────────"));

	if (newReleases.length === 0) {
		console.log();
		console.log(pc.green("  ✓ All releases already downloaded!"));
		console.log();
		process.exit(0);
	}

	// Dry run
	if (opts.dryRun) {
		console.log();
		console.log(pc.yellow("  🔍 Dry run mode - no files will be downloaded."));
		console.log();
		for (const release of newReleases) {
			console.log(
				pc.dim("  │ ") + pc.cyan("📁 ") + pc.white(release.folderPath),
			);
			console.log(
				pc.dim("  │    ") + pc.dim(`${release.album.nb_tracks} tracks`),
			);
		}
		console.log();
		process.exit(0);
	}

	// ===== PHASE 4: CREATE FOLDERS =====
	createReleaseFolders(newReleases);

	// ===== PHASE 5: DOWNLOAD =====
	console.log();
	console.log(
		pc.bold(pc.white(`  ⬇ Downloading ${newReleases.length} releases...`)),
	);
	console.log();

	const allResults: DownloadResult[] = [];
	let releaseIndex = 0;

	for (const release of newReleases) {
		releaseIndex++;
		const releaseLabel = `[${releaseIndex}/${newReleases.length}]`;
		console.log(
			pc.dim("  ┌─") +
				pc.bold(pc.magenta(` ${releaseLabel} `)) +
				pc.bold(pc.white(release.album.title)) +
				pc.dim(` • ${release.releaseType}`),
		);
		console.log(pc.dim("  │ ") + pc.dim(release.folderPath));

		const progressBar = createProgressBar();
		let trackCount = 0;
		const trackErrors: string[] = [];

		const downloader = new Downloader(dz, {
			bitrate,
			downloadPath: release.folderPath,
			onTrackStart: (_track, idx, total) => {
				if (idx === 1) {
					progressBar.start(total, 0);
				}
			},
			onTrackComplete: (result) => {
				trackCount++;
				progressBar.update(trackCount);
				if (!result.success) {
					trackErrors.push(`${result.trackTitle}: ${result.error}`);
				}
			},
		});

		const results = await downloader.downloadAlbum(
			release.album.id,
			release.album.title,
		);
		progressBar.stop();

		// Show result
		const successCount = results.filter((r) => r.success).length;
		const failCount = results.filter((r) => !r.success).length;

		if (successCount === 0 && failCount > 0) {
			// All tracks failed - delete the empty folder so it's not skipped next time
			console.log(pc.dim("  │ ") + pc.red(`✗ All ${failCount} tracks failed`));
			for (const err of trackErrors.slice(0, 3)) {
				console.log(pc.dim("  │   ") + pc.red(`✗ ${err}`));
			}
			if (trackErrors.length > 3) {
				console.log(
					pc.dim("  │   ") +
						pc.dim(`... and ${trackErrors.length - 3} more errors`),
				);
			}
			// Clean up empty folder
			try {
				fs.rmSync(release.folderPath, { recursive: true, force: true });
				console.log(
					pc.dim("  │ ") +
						pc.dim("🗑 Removed empty folder (will retry next run)"),
				);
			} catch {
				// Ignore cleanup errors
			}
		} else if (failCount === 0) {
			console.log(
				pc.dim("  │ ") + pc.green(`✓ Complete • ${successCount} tracks`),
			);
		} else {
			console.log(
				pc.dim("  │ ") +
					pc.yellow(`⚠ ${successCount} downloaded, ${failCount} failed`),
			);
			for (const err of trackErrors.slice(0, 3)) {
				console.log(pc.dim("  │   ") + pc.red(`✗ ${err}`));
			}
			if (trackErrors.length > 3) {
				console.log(
					pc.dim("  │   ") +
						pc.dim(`... and ${trackErrors.length - 3} more errors`),
				);
			}
		}
		console.log(pc.dim("  └────────────────────────────────────────────"));
		console.log();

		// Only add results for albums that had at least some success
		// (fully failed albums get cleaned up and should retry)
		if (successCount > 0) {
			allResults.push(...results);
		}
	}

	// ===== PHASE 6: REPORT =====
	const successful = allResults.filter((r) => r.success);
	const failed = allResults.filter((r) => !r.success);

	printSummary(successful.length, existingReleases.length, failed.length);

	if (failed.length > 0) {
		console.log(pc.dim("  Failed tracks:"));
		for (const result of failed.slice(0, 10)) {
			console.log(
				pc.red(`    ✗ ${result.trackTitle}: `) +
					pc.dim(result.error || "Unknown error"),
			);
		}
		if (failed.length > 10) {
			console.log(pc.dim(`    ... and ${failed.length - 10} more`));
		}
		console.log();
	}

	process.exit(failed.length > 0 ? 1 : 0);
}

export async function downloadTrack(
	trackQuery: string,
	opts: { artist?: string; bitrate: string; dryRun?: boolean },
) {
	const bitrate = parseBitrate(opts.bitrate);

	printHeader();

	// Load config
	const config = loadConfig();
	printConfig(config.musicRootPath, getEnvPathForDisplay());

	// Initialize Deezer and login
	const dz = new Deezer();
	const arl = await loginWithPrompt(dz);

	// Check subscription
	if (bitrate === TrackFormats.FLAC && !dz.currentUser?.can_stream_lossless) {
		console.log(
			pc.yellow(
				"  ⚠ Your account doesn't support FLAC. Falling back to MP3 320.",
			),
		);
	}

	// ===== PHASE 1: SEARCH =====
	const searchSpinner = ora({
		text: `Searching for "${pc.bold(trackQuery)}"${opts.artist ? ` by ${pc.bold(opts.artist)}` : ""}...`,
		prefixText: " ",
		color: "cyan",
	}).start();

	try {
		const result = await downloadTrackAPI({
			trackQuery,
			artistName: opts.artist,
			musicRootPath: config.musicRootPath,
			bitrate,
			dryRun: opts.dryRun,
			deezerArl: arl,
		});

		searchSpinner.succeed(
			`Found ${pc.bold(pc.magenta(result.track.title))} by ${pc.bold(pc.cyan(result.track.artist.name))} ${pc.dim(`(ID: ${result.track.id})`)}`,
		);

		// Show track info
		console.log();
		console.log(pc.dim("  ┌─ Track Info ──────────────────────────────────"));
		console.log(
			pc.dim("  │ ") + pc.cyan("Title:  ") + pc.white(result.track.title),
		);
		console.log(
			pc.dim("  │ ") + pc.cyan("Artist: ") + pc.white(result.track.artist.name),
		);
		console.log(
			pc.dim("  │ ") + pc.cyan("Album:  ") + pc.white(result.track.album.title),
		);
		console.log(
			pc.dim("  │ ") +
				pc.cyan("Path:   ") +
				pc.dim(result.downloadResult.filePath || "N/A"),
		);
		console.log(pc.dim("  └───────────────────────────────────────────────"));

		if (opts.dryRun) {
			console.log();
			console.log(pc.yellow("  🔍 Dry run mode - no files were downloaded."));
			console.log();
			process.exit(0);
		}

		// Show result
		console.log();
		if (result.downloadResult.success) {
			console.log(
				pc.green(
					`  ✓ Successfully downloaded: ${pc.bold(result.downloadResult.trackTitle)}`,
				),
			);
			console.log(pc.dim(`    ${result.downloadResult.filePath}`));
		} else {
			console.log(
				pc.red(
					`  ✗ Failed to download: ${pc.bold(result.downloadResult.trackTitle)}`,
				),
			);
			console.log(
				pc.red(`    Error: ${result.downloadResult.error || "Unknown error"}`),
			);
			process.exit(1);
		}

		console.log();
		process.exit(0);
	} catch (error) {
		searchSpinner.fail(pc.red((error as Error).message));
		process.exit(1);
	}
}
