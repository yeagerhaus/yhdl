// Library operations

export type { Config } from "../config.js";
// Config
export {
	clearArl,
	clearConfig,
	getConfig,
	getEnvPathForDisplay,
	loadArl,
	loadConfig,
	saveArl,
	setConfig,
} from "../config.js";
// Deezer client
export { Deezer, TrackFormats } from "../deezer/index.js";
export type {
	APIAlbum,
	APIArtist,
	APIContributor,
	APIOptions,
	APITrack,
	DiscographyAlbum,
	EnrichedAPIAlbum,
	EnrichedAPIArtist,
	EnrichedAPIContributor,
	EnrichedAPITrack,
	GWAlbum,
	GWArtist,
	GWTrack,
	SearchOrder,
	User,
} from "../deezer/types.js";
export type {
	DownloadProgress,
	ProgressCallback,
} from "../downloader/decryption.js";
export { streamTrack } from "../downloader/decryption.js";
export type { DownloaderOptions } from "../downloader/downloader.js";
export { Downloader } from "../downloader/downloader.js";
export type { TagOptions } from "../downloader/tagger.js";
export { downloadCover, tagTrack } from "../downloader/tagger.js";
export type {
	AlbumDownloadInfo,
	DownloadResult,
	ReleaseToDownload,
	TrackDownloadInfo,
} from "../downloader/types.js";
export type { ReleaseType, ResolvedRelease } from "../folder-resolver.js";
// Folder operations
export {
	createReleaseFolders,
	findOrCreateArtistFolder,
	getExistingReleases,
	matchReleaseToFolder,
	resolveArtistReleases,
} from "../folder-resolver.js";
export {
	extractArtistsFromFolders,
	extractArtistsFromMetadata,
	normalizeArtistName,
	scanLibrary,
} from "../library/scanner.js";
export type { LibraryArtist, ScanOptions } from "../library/types.js";
export type { FailureLogEntry, SyncSummary } from "../sync/logger.js";

// Logging
export {
	clearFailureLog,
	loadFailureLog,
	writeFailureLog,
} from "../sync/logger.js";
// State management
export {
	getLastCheck,
	loadState,
	saveState,
	shouldSkipArtist,
	updateArtistCheck,
} from "../sync/state.js";
export type { NewRelease, SyncOptions, SyncResult } from "../sync/sync.js";
// Sync operations
export { checkArtist, syncLibrary } from "../sync/sync.js";
export type { ArtistState, SyncState } from "../sync/types.js";
// Utilities
export { parseBitrate } from "../utils.js";
export type {
	DownloadArtistOptions,
	DownloadArtistResult,
	DownloadTrackOptions,
	DownloadTrackResult,
} from "./download.js";
// Download operations
export { downloadArtist, downloadTrack } from "./download.js";
