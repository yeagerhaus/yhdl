import { Deezer, TrackFormats, type DiscographyAlbum, type APIArtist, type APITrack } from "../deezer/index.js";
import { Downloader, type DownloadResult } from "../downloader/index.js";
import { resolveArtistReleases, createReleaseFolders, type ResolvedRelease, findOrCreateArtistFolder, determineReleaseType, sanitizeFolderName } from "../folder-resolver.js";
import { loadArl, getConfig } from "../config.js";
import { parseBitrate } from "../utils.js";
import path from "path";
import fs from "fs";
import type { GWTrack } from "../deezer/types.js";

export interface DownloadArtistOptions {
	artistName: string;
	musicRootPath?: string;
	bitrate?: number | string;
	dryRun?: boolean;
	deezerArl?: string;
}

export interface DownloadArtistResult {
	artist: APIArtist;
	releases: ResolvedRelease[];
	existingReleases: ResolvedRelease[];
	newReleases: ResolvedRelease[];
	downloadResults: DownloadResult[];
	downloadedTracks: number;
	failedTracks: number;
}

/**
 * Programmatic function to download an artist's discography
 */
export async function downloadArtist(options: DownloadArtistOptions): Promise<DownloadArtistResult> {
	const {
		artistName,
		musicRootPath,
		bitrate = TrackFormats.FLAC,
		dryRun = false,
		deezerArl,
	} = options;

	// Get config (programmatic or env-based)
	const config = getConfig();
	const finalMusicRootPath = musicRootPath || config.musicRootPath;
	const finalBitrate = parseBitrate(bitrate);

	// Initialize Deezer
	const dz = new Deezer();

	// Login (ARL from options, config, or .env)
	const arl = deezerArl || loadArl();
	if (!arl) {
		throw new Error("DEEZER_ARL not found. Provide it via options.deezerArl, setConfig(), or DEEZER_ARL environment variable.");
	}

	const loggedIn = await dz.loginViaArl(arl);
	if (!loggedIn) {
		throw new Error("Failed to login to Deezer. Check your ARL token.");
	}

	// Search for artist
	const searchResults = await dz.api.search_artist(artistName, { limit: 5 });
	if (!searchResults.data.length) {
		throw new Error(`No artists found for "${artistName}"`);
	}

	const artist = searchResults.data[0];

	// Get discography
	const discography = await dz.gw.get_artist_discography_tabs(artist.id, { limit: 100 });
	const allReleases: DiscographyAlbum[] = discography.all || [];

	if (allReleases.length === 0) {
		return {
			artist,
			releases: [],
			existingReleases: [],
			newReleases: [],
			downloadResults: [],
			downloadedTracks: 0,
			failedTracks: 0,
		};
	}

	// Resolve releases
	const resolvedReleases = resolveArtistReleases(
		finalMusicRootPath,
		artist.name,
		artist.id,
		allReleases
	);

	const existingReleases = resolvedReleases.filter((r) => r.exists);
	const newReleases = resolvedReleases.filter((r) => !r.exists);

	// If dry run or no new releases, return early
	if (dryRun || newReleases.length === 0) {
		return {
			artist,
			releases: resolvedReleases,
			existingReleases,
			newReleases,
			downloadResults: [],
			downloadedTracks: 0,
			failedTracks: 0,
		};
	}

	// Create folders
	createReleaseFolders(newReleases);

	// Download releases
	const allDownloadResults: DownloadResult[] = [];

	for (const release of newReleases) {
		try {
			const downloader = new Downloader(dz, {
				bitrate: finalBitrate,
				downloadPath: release.folderPath,
				releaseType: release.releaseType,
			});

			const results = await downloader.downloadAlbum(release.album.id, release.album.title);
			allDownloadResults.push(...results);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Add error results for all tracks in the release
			const errorResults: DownloadResult[] = Array.from(
				{ length: release.album.nb_tracks || 0 },
				(_, i) => ({
					success: false,
					trackId: 0,
					trackTitle: `Track ${i + 1}`,
					error: `Failed to download release: ${errorMessage}`,
				})
			);
			allDownloadResults.push(...errorResults);
		}
	}

	const downloadedTracks = allDownloadResults.filter((r) => r.success).length;
	const failedTracks = allDownloadResults.filter((r) => !r.success).length;

	return {
		artist,
		releases: resolvedReleases,
		existingReleases,
		newReleases,
		downloadResults: allDownloadResults,
		downloadedTracks,
		failedTracks,
	};
}

export interface DownloadTrackOptions {
	trackQuery: string;
	artistName?: string;
	musicRootPath?: string;
	bitrate?: number | string;
	dryRun?: boolean;
	deezerArl?: string;
}

export interface DownloadTrackResult {
	track: APITrack;
	downloadResult: DownloadResult;
}

/**
 * Programmatic function to download a specific track/song
 */
export async function downloadTrack(options: DownloadTrackOptions): Promise<DownloadTrackResult> {
	const {
		trackQuery,
		artistName,
		musicRootPath,
		bitrate = TrackFormats.FLAC,
		dryRun = false,
		deezerArl,
	} = options;

	// Get config (programmatic or env-based)
	const config = getConfig();
	const finalMusicRootPath = musicRootPath || config.musicRootPath;
	const finalBitrate = parseBitrate(bitrate);

	// Initialize Deezer
	const dz = new Deezer();

	// Login (ARL from options, config, or .env)
	const arl = deezerArl || loadArl();
	if (!arl) {
		throw new Error("DEEZER_ARL not found. Provide it via options.deezerArl, setConfig(), or DEEZER_ARL environment variable.");
	}

	const loggedIn = await dz.loginViaArl(arl);
	if (!loggedIn) {
		throw new Error("Failed to login to Deezer. Check your ARL token.");
	}

	// Search for track
	let searchQuery = trackQuery;
	if (artistName) {
		searchQuery = `${artistName} ${trackQuery}`;
	}

	const searchResults = await dz.api.search(searchQuery, { limit: 10 });
	const tracks = (searchResults.data || []) as APITrack[];

	if (tracks.length === 0) {
		throw new Error(`No tracks found for "${trackQuery}"${artistName ? ` by ${artistName}` : ""}`);
	}

	// If artist name provided, try to find a match
	let selectedTrack = tracks[0];
	if (artistName) {
		const artistLower = artistName.toLowerCase();
		const match = tracks.find(
			(t) => t.artist.name.toLowerCase().includes(artistLower) || artistLower.includes(t.artist.name.toLowerCase())
		);
		if (match) {
			selectedTrack = match;
		}
	}

	// Get full track info via GW API
	const gwTrack = await dz.gw.get_track_with_fallback(selectedTrack.id);

	// Determine download path
	const trackArtist = selectedTrack.artist.name;
	const trackAlbum = selectedTrack.album.title;
	const artistFolder = findOrCreateArtistFolder(finalMusicRootPath, trackArtist);
	
	// Determine release type from album
	const releaseType = determineReleaseType({
		record_type: selectedTrack.album.record_type || "album",
		nb_tracks: selectedTrack.album.nb_tracks || 1,
	} as DiscographyAlbum);

	// Create album folder
	const albumFolder = path.join(artistFolder, sanitizeFolderName(trackAlbum));
	if (!dryRun) {
		if (!fs.existsSync(albumFolder)) {
			fs.mkdirSync(albumFolder, { recursive: true });
		}
	}

	// If dry run, return early
	if (dryRun) {
		return {
			track: selectedTrack,
			downloadResult: {
				success: true,
				trackId: selectedTrack.id,
				trackTitle: selectedTrack.title,
				filePath: path.join(albumFolder, `${String(selectedTrack.track_position || 1).padStart(2, "0")} - ${selectedTrack.title}.flac`),
			},
		};
	}

	// Download the track
	const downloader = new Downloader(dz, {
		bitrate: finalBitrate,
		downloadPath: albumFolder,
		releaseType,
	});

	const result = await downloader.downloadTrack(gwTrack, trackAlbum);

	return {
		track: selectedTrack,
		downloadResult: result,
	};
}
