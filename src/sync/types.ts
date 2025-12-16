export interface ArtistState {
	name: string;
	lastChecked: string; // ISO timestamp
	lastReleaseDate?: string;
	deezerId?: number;
	existingReleases?: string[]; // Cached list of release folder names that exist
}

export interface LibraryCache {
	artists: Array<{
		name: string;
		path: string;
	}>;
	lastScanned: string; // ISO timestamp
	musicRootPath: string; // Path that was scanned
}

export interface SyncState {
	artists: Record<number, ArtistState>;
	lastFullSync?: string; // ISO timestamp
	libraryCache?: LibraryCache; // Cached library scan results
	ignoredArtists?: string[]; // List of artist names to ignore (case-insensitive)
	version: string; // For future migrations
}

