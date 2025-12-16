#!/usr/bin/env node

/**
 * Scheduled sync script - non-interactive version for task scheduling
 * This script runs the sync operation without prompting for user input.
 * It requires DEEZER_ARL to be set in environment variables or .env file.
 */

import { syncLibrary } from "../sync/sync.js";
import { loadConfig, loadArl } from "../config.js";
import { Deezer, TrackFormats } from "../deezer/index.js";
import { parseBitrate } from "../utils.js";
import pc from "picocolors";
import fs from "fs";
import path from "path";

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
	full?: boolean;
	bitrate?: string;
	concurrency?: string;
	checkIntervalHours?: string;
	logFile?: string;
} = {};

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--full") {
		options.full = true;
	} else if (arg === "--bitrate" && args[i + 1]) {
		options.bitrate = args[++i];
	} else if (arg === "--concurrency" && args[i + 1]) {
		options.concurrency = args[++i];
	} else if (arg === "--since" && args[i + 1]) {
		options.checkIntervalHours = args[++i];
	} else if (arg === "--log" && args[i + 1]) {
		options.logFile = args[++i];
	}
}


function log(message: string) {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${message}`;
	console.log(logMessage);
	
	if (options.logFile) {
		try {
			// Ensure log directory exists
			const logDir = path.dirname(options.logFile);
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true });
			}
			fs.appendFileSync(options.logFile, logMessage + "\n", "utf-8");
		} catch (error) {
			// Silently fail if log file can't be written
		}
	}
}

async function main() {
	log("=".repeat(60));
	log("Starting scheduled library sync");
	log("=".repeat(60));

	const config = loadConfig();
	const bitrate = parseBitrate(options.bitrate || "flac");
	const concurrency = parseInt(options.concurrency || "5", 10) || 5;
	const checkIntervalHours = parseInt(options.checkIntervalHours || "24", 10) || 24;

	log(`Music root path: ${config.musicRootPath}`);
	log(`Bitrate: ${options.bitrate || "flac"}`);
	log(`Concurrency: ${concurrency}`);
	log(`Check interval: ${checkIntervalHours} hours`);
	log(`Full sync: ${options.full ? "yes" : "no"}`);

	// Check for ARL
	const arl = loadArl();
	if (!arl) {
		const errorMsg = "ERROR: DEEZER_ARL not found. Please set it in your .env file or environment variables.";
		log(errorMsg);
		console.error(pc.red(errorMsg));
		process.exit(1);
	}

	// Initialize Deezer
	const dz = new Deezer();
	log("Logging in to Deezer...");

	const loggedIn = await dz.loginViaArl(arl);
	if (!loggedIn) {
		const errorMsg = "ERROR: Failed to login to Deezer. Check your ARL token.";
		log(errorMsg);
		console.error(pc.red(errorMsg));
		process.exit(1);
	}

	log(`Logged in as: ${dz.currentUser?.name || "Unknown"}`);

	// Run sync
	try {
		log("Scanning music library for artists...");
		log("This may take several minutes for large libraries...");
		const result = await syncLibrary({
			musicRootPath: config.musicRootPath,
			bitrate,
			concurrency,
			checkIntervalHours,
			fullSync: options.full || false,
			dryRun: false,
			statePath: config.syncStatePath,
			errorLogPath: config.errorLogPath,
			deezerArl: arl,
		});

		log("=".repeat(60));
		log("Sync completed");
		log(`Total artists: ${result.summary.totalArtists}`);
		log(`Artists checked: ${result.summary.checkedArtists}`);
		log(`Artists skipped: ${result.summary.skippedArtists}`);
		log(`New releases found: ${result.summary.newReleases}`);
		log(`Tracks downloaded: ${result.summary.downloadedTracks}`);
		if (result.summary.failedTracks > 0) {
			log(`Failed tracks: ${result.summary.failedTracks}`);
		}
		log(`Duration: ${Math.round(result.summary.duration / 1000)}s`);
		log("=".repeat(60));

		if (result.errors.length > 0) {
			log(`Errors encountered: ${result.errors.length}`);
			for (const error of result.errors) {
				log(`  - ${error.artist}: ${error.error}`);
			}
		}

		// Exit with error code if there were failures
		process.exit(result.summary.failedTracks > 0 ? 1 : 0);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		log(`FATAL ERROR: ${errorMsg}`);
		console.error(pc.red(`FATAL ERROR: ${errorMsg}`));
		if (error instanceof Error && error.stack) {
			log(error.stack);
		}
		process.exit(1);
	}
}

main().catch((error) => {
	const errorMsg = error instanceof Error ? error.message : String(error);
	log(`UNHANDLED ERROR: ${errorMsg}`);
	console.error(pc.red(`UNHANDLED ERROR: ${errorMsg}`));
	if (error instanceof Error && error.stack) {
		log(error.stack);
	}
	process.exit(1);
});

