export interface LibraryArtist {
	name: string;
	path: string;
	source: "metadata" | "folder";
	fileCount?: number;
}

export interface ScanProgress {
	artistsFound: number;
	directoriesScanned: number;
	totalDirectories?: number;
	filesProcessed: number;
	currentPath?: string;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

export interface ScanOptions {
	includeMetadata?: boolean;
	includeFolders?: boolean;
	maxDepth?: number;
	onProgress?: ScanProgressCallback;
}

