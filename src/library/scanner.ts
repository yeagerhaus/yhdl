import fs from "fs";
import path from "path";
import NodeID3 from "node-id3";
import type { LibraryArtist, ScanOptions, ScanProgress } from "./types.js";

const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav", ".wma"]);

/**
 * Normalize artist name for matching (lowercase, trim, remove special chars)
 */
export function normalizeArtistName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s]/g, "")
		.replace(/\s+/g, " ");
}

/**
 * Check if a file is an audio file based on extension
 */
function isAudioFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return AUDIO_EXTENSIONS.has(ext);
}

/**
 * Extract artist names from audio file metadata
 */
export async function extractArtistsFromMetadata(filePath: string): Promise<string[]> {
	try {
		const tags = NodeID3.read(filePath);
		const artists: string[] = [];

		// Primary artist
		if (tags.artist) {
			artists.push(tags.artist);
		}

		// Album artist (often more accurate for compilations)
		// Use TPE2 (ID3v2 frame for album artist) or check if albumArtist exists
		const albumArtist = (tags as Record<string, unknown>).albumArtist || (tags as Record<string, unknown>).TPE2;
		if (albumArtist && typeof albumArtist === "string") {
			artists.push(albumArtist);
		}

		// Performer tags (ID3v2.3/2.4)
		const performerInfo = (tags as Record<string, unknown>).performerInfo;
		if (performerInfo) {
			if (Array.isArray(performerInfo)) {
				for (const performer of performerInfo) {
					if (typeof performer === "string") {
						if (!artists.includes(performer)) {
							artists.push(performer);
						}
					} else if (performer && typeof performer === "object" && "performer" in performer) {
						const performerName = (performer as { performer?: string }).performer;
						if (performerName && typeof performerName === "string" && !artists.includes(performerName)) {
							artists.push(performerName);
						}
					}
				}
			}
		}

		// Remove duplicates and empty strings
		return artists.filter((a) => a && a.trim().length > 0);
	} catch {
		return [];
	}
}

/**
 * Count total directories for progress tracking
 */
function countDirectories(rootPath: string, maxDepth: number): number {
	let count = 0;
	if (!fs.existsSync(rootPath)) {
		return count;
	}

	function walkDir(dir: string, depth: number): void {
		if (depth > maxDepth) return;
		count++;

		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory()) {
					walkDir(path.join(dir, entry.name), depth + 1);
				}
			}
		} catch {
			// Ignore errors
		}
	}

	walkDir(rootPath, 0);
	return count;
}

/**
 * Extract artist names from folder structure
 * Assumes structure: root/Artist/Album/...
 * Optimized: Just reads folder names, doesn't check for audio files (much faster)
 */
export function extractArtistsFromFolders(
	rootPath: string,
	maxDepth: number = 3,
	onProgress?: (progress: ScanProgress) => void
): string[] {
	const artists: string[] = [];
	const visited = new Set<string>();
	let directoriesScanned = 0;

	if (!fs.existsSync(rootPath)) {
		return artists;
	}

	// Fast path: Just get all top-level directories as artists
	// This is much faster than checking for audio files
	try {
		const entries = fs.readdirSync(rootPath, { withFileTypes: true });
		
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const artistName = entry.name;
				const normalized = normalizeArtistName(artistName);
				
				// Skip common non-artist folders
				if (normalized && 
				    !visited.has(normalized) &&
				    !["lost+found", "system volume information", "$recycle.bin", ".trash"].includes(normalized.toLowerCase())) {
					artists.push(artistName);
					visited.add(normalized);
					directoriesScanned++;
					
					if (onProgress && artists.length % 10 === 0) {
						onProgress({
							artistsFound: artists.length,
							directoriesScanned,
							filesProcessed: 0,
							currentPath: path.join(rootPath, artistName),
						});
					}
				}
			}
		}
		
		// Final progress update
		if (onProgress) {
			onProgress({
				artistsFound: artists.length,
				directoriesScanned,
				filesProcessed: 0,
				currentPath: rootPath,
			});
		}
	} catch {
		// Ignore permission errors, etc.
	}

	return artists;
}

/**
 * Count audio files in a directory (recursively)
 */
function countAudioFiles(dir: string): number {
	let count = 0;
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isFile() && isAudioFile(fullPath)) {
				count++;
			} else if (entry.isDirectory()) {
				count += countAudioFiles(fullPath);
			}
		}
	} catch {
		// Ignore errors
	}
	return count;
}

/**
 * Scan entire music library to discover all artists
 * Combines metadata and folder-based discovery
 */
export async function scanLibrary(
	rootPath: string,
	options: ScanOptions = {}
): Promise<LibraryArtist[]> {
	const {
		includeMetadata = true,
		includeFolders = true,
		maxDepth = 3,
		onProgress,
	} = options;

	const artistMap = new Map<string, LibraryArtist>();

	// Method 1: Extract from folder structure (fast)
	if (includeFolders) {
		const folderArtists = extractArtistsFromFolders(rootPath, maxDepth, onProgress);
		for (const artistName of folderArtists) {
			const normalized = normalizeArtistName(artistName);
			const artistPath = path.join(rootPath, artistName);

			if (!artistMap.has(normalized)) {
				artistMap.set(normalized, {
					name: artistName,
					path: artistPath,
					source: "folder",
				});
			}
		}
	}

	// Method 2: Extract from metadata (more accurate but slower)
	if (includeMetadata) {
		const metadataArtists = await extractArtistsFromMetadataRecursive(
			rootPath,
			maxDepth,
			0,
			onProgress
		);
		for (const { artistName, filePath } of metadataArtists) {
			const normalized = normalizeArtistName(artistName);
			const existing = artistMap.get(normalized);

			if (!existing) {
				// New artist from metadata
				artistMap.set(normalized, {
					name: artistName,
					path: path.dirname(filePath),
					source: "metadata",
				});
			} else if (existing.source === "folder") {
				// Prefer metadata over folder (more accurate)
				existing.source = "metadata";
				existing.path = path.dirname(filePath);
			}
		}
	}

	// Count files for each artist
	const results: LibraryArtist[] = [];
	for (const artist of artistMap.values()) {
		const fileCount = countAudioFiles(artist.path);
		results.push({
			...artist,
			fileCount: fileCount > 0 ? fileCount : undefined,
		});
	}

	// Sort by name
	return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively scan directory for audio files and extract artist metadata
 */
async function extractArtistsFromMetadataRecursive(
	dir: string,
	maxDepth: number,
	currentDepth = 0,
	onProgress?: (progress: ScanProgress) => void
): Promise<Array<{ artistName: string; filePath: string }>> {
	const results: Array<{ artistName: string; filePath: string }> = [];
	let filesProcessed = 0;

	if (currentDepth > maxDepth) {
		return results;
	}

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isFile() && isAudioFile(fullPath)) {
				const artists = await extractArtistsFromMetadata(fullPath);
				for (const artist of artists) {
					results.push({ artistName: artist, filePath: fullPath });
				}
				filesProcessed++;
				
				// Report progress every 50 files
				if (onProgress && filesProcessed % 50 === 0) {
					const uniqueArtists = new Set(results.map((r) => r.artistName));
					onProgress({
						artistsFound: uniqueArtists.size,
						directoriesScanned: 0,
						filesProcessed,
						currentPath: fullPath,
					});
				}
			} else if (entry.isDirectory()) {
				const subResults = await extractArtistsFromMetadataRecursive(
					fullPath,
					maxDepth,
					currentDepth + 1,
					onProgress
				);
				results.push(...subResults);
			}
		}
	} catch {
		// Ignore errors
	}

	return results;
}

