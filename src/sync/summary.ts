import fs from "fs";
import path from "path";
import type { SyncResult } from "./sync.js";

export interface SyncSummaryFile {
	timestamp: string;
	summary: {
		totalArtists: number;
		checkedArtists: number;
		skippedArtists: number;
		newReleases: number;
		downloadedTracks: number;
		failedTracks: number;
		duration: number;
	};
	downloadedReleases: Array<{
		artist: string;
		artistId: number;
		release: string;
		releaseId: number;
		releaseDate?: string;
		tracks: number;
		releaseType: string;
	}>;
	errors: Array<{
		artist: string;
		error: string;
	}>;
}

/**
 * Generate and save a summary file from sync results
 */
export function generateSummaryFile(
	result: SyncResult,
	outputPath: string
): void {
	const dir = path.dirname(outputPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	const summary: SyncSummaryFile = {
		timestamp: new Date().toISOString(),
		summary: result.summary,
		downloadedReleases: result.downloadedReleases,
		errors: result.errors,
	};

	try {
		fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf-8");
	} catch (error) {
		console.error(`Error writing summary file: ${error}`);
	}
}

