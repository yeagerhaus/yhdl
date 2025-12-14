/**
 * Test helper utilities
 */

import fs from "fs";
import path from "path";
import os from "os";

/**
 * Create a temporary directory for testing
 */
export function createTempDir(prefix = "yhdl-test"): string {
	const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`);
	fs.mkdirSync(tempDir, { recursive: true });
	return tempDir;
}

/**
 * Remove a directory and all its contents
 */
export function removeTempDir(dir: string): void {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * Create a mock audio file (empty file with audio extension)
 */
export function createMockAudioFile(dir: string, filename: string): string {
	const filePath = path.join(dir, filename);
	fs.writeFileSync(filePath, "fake audio content");
	return filePath;
}

/**
 * Create a mock artist folder structure
 */
export function createMockArtistFolder(root: string, artistName: string, releases: string[] = []): string {
	const artistPath = path.join(root, artistName);
	fs.mkdirSync(artistPath, { recursive: true });

	for (const release of releases) {
		const releasePath = path.join(artistPath, release);
		fs.mkdirSync(releasePath, { recursive: true });
		// Add a mock audio file
		createMockAudioFile(releasePath, "01 - Track 1.mp3");
	}

	return artistPath;
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

