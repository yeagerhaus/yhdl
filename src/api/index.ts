// Library operations
export { scanLibrary, extractArtistsFromMetadata, extractArtistsFromFolders, normalizeArtistName } from "../library/scanner.js";
export type { LibraryArtist, ScanOptions } from "../library/types.js";

// Utilities
export { parseBitrate } from "../utils.js";

// Sync operations
export { syncLibrary, checkArtist } from "../sync/sync.js";
export type { SyncOptions, SyncResult, NewRelease } from "../sync/sync.js";

// Download operations
export { downloadArtist } from "./download.js";
export type { DownloadArtistOptions, DownloadArtistResult } from "./download.js";
export { Downloader } from "../downloader/downloader.js";
export type { DownloadResult, DownloaderOptions } from "../downloader/downloader.js";
export type {
	TrackDownloadInfo,
	AlbumDownloadInfo,
	ReleaseToDownload,
} from "../downloader/types.js";
export { streamTrack } from "../downloader/decryption.js";
export type { DownloadProgress, ProgressCallback } from "../downloader/decryption.js";
export { tagTrack, downloadCover } from "../downloader/tagger.js";
export type { TagOptions } from "../downloader/tagger.js";

// State management
export { loadState, saveState, updateArtistCheck, getLastCheck, shouldSkipArtist } from "../sync/state.js";
export type { SyncState, ArtistState } from "../sync/types.js";

// Logging
export { loadFailureLog, writeFailureLog, clearFailureLog } from "../sync/logger.js";
export type { SyncSummary, FailureLogEntry } from "../sync/logger.js";

// Config
export { loadConfig, getConfig, setConfig, clearConfig, loadArl, saveArl, clearArl, getEnvPathForDisplay } from "../config.js";
export type { Config } from "../config.js";

// Folder operations
export {
	resolveArtistReleases,
	findOrCreateArtistFolder,
	getExistingReleases,
	matchReleaseToFolder,
	createReleaseFolders,
} from "../folder-resolver.js";
export type { ResolvedRelease, ReleaseType } from "../folder-resolver.js";

// Deezer client
export { Deezer, TrackFormats } from "../deezer/index.js";
export type {
	DiscographyAlbum,
	APIArtist,
	User,
	GWTrack,
	GWAlbum,
	GWArtist,
	APITrack,
	APIAlbum,
	EnrichedAPITrack,
	EnrichedAPIAlbum,
	EnrichedAPIArtist,
	APIContributor,
	EnrichedAPIContributor,
	APIOptions,
	SearchOrder,
} from "../deezer/types.js";

