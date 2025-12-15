import { Deezer, TrackFormats, type DiscographyAlbum, type APIArtist } from "../deezer/index.js";
import { Downloader, type DownloadResult } from "../downloader/index.js";
import { resolveArtistReleases, createReleaseFolders, type ResolvedRelease } from "../folder-resolver.js";
import { loadArl, getConfig } from "../config.js";

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

function parseBitrate(bitrate: number | string | undefined): number {
	if (typeof bitrate === "number") {
		return bitrate;
	}
	if (typeof bitrate === "string") {
		switch (bitrate.toLowerCase()) {
			case "flac":
				return TrackFormats.FLAC;
			case "320":
			case "mp3_320":
				return TrackFormats.MP3_320;
			case "128":
			case "mp3_128":
				return TrackFormats.MP3_128;
			default:
				return TrackFormats.FLAC;
		}
	}
	return TrackFormats.FLAC;
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
