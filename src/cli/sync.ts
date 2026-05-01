#!/usr/bin/env node

import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import pkg from "../../package.json" with { type: "json" };
import { loadConfig } from "../config.js";
import { Deezer } from "../deezer/index.js";
import { syncLibrary } from "../sync/sync.js";
import { parseBitrate } from "../utils.js";
import { loginWithPrompt } from "./auth.js";

export interface SyncCommandOpts {
	full?: boolean;
	artist?: string;
	dryRun?: boolean;
	concurrency: string;
	since: string;
	bitrate: string;
}

export async function syncCommand(opts: SyncCommandOpts) {
	const config = loadConfig();
	const bitrate = parseBitrate(opts.bitrate);
	const concurrency = parseInt(opts.concurrency, 10) || 5;
	const checkIntervalHours = parseInt(opts.since, 10) || 24;

	// Handle login
	const dz = new Deezer();
	await loginWithPrompt(dz);

	// Run sync
	const result = await syncLibrary({
		musicRootPath: config.musicRootPath,
		bitrate,
		concurrency,
		checkIntervalHours,
		fullSync: opts.full || false,
		dryRun: opts.dryRun || false,
		specificArtist: opts.artist,
		statePath: config.syncStatePath,
		errorLogPath: config.errorLogPath,
	});

	// Show summary file location if created
	if (result.downloadedReleases.length > 0 || result.errors.length > 0) {
		const summaryPath = path.join(
			path.dirname(config.syncStatePath || ".yhdl/sync-state.json"),
			"sync-summary.json",
		);
		console.log(pc.dim(`  Summary saved to: ${summaryPath}`));
		console.log();
	}

	// Trigger Plex webhook if configured and there were downloads
	if (config.plexWebhookUrl && result.downloadedReleases.length > 0) {
		const { triggerPlexScan } = await import("../utils/plex.js");
		console.log(pc.dim("  Triggering Plex library scan..."));
		const plexSuccess = await triggerPlexScan({
			url: config.plexWebhookUrl,
			token: config.plexWebhookToken,
		});
		if (plexSuccess) {
			console.log(pc.green("  ✓ Plex scan triggered"));
		}
		console.log();
	}

	// Exit with appropriate code
	process.exit(result.summary.failedTracks > 0 ? 1 : 0);
}

// Run the command if this file is executed directly
if (import.meta.main) {
	const program = new Command();
	program
		.name("yhdl-sync")
		.description(
			"Sync entire music library - check all artists for new releases",
		)
		.version(pkg.version)
		.option("--full", "Force check all artists (ignore last check time)")
		.option("--artist <name>", "Sync specific artist only")
		.option(
			"--dry-run",
			"Preview what would be downloaded without actually downloading",
		)
		.option("-c, --concurrency <n>", "Parallel artist checks", "5")
		.option(
			"--since <hours>",
			"Only check artists not checked in last N hours",
			"24",
		)
		.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
		.parse();

	syncCommand(program.opts<SyncCommandOpts>()).catch((e) => {
		console.error(pc.red("Error:"), e.message);
		process.exit(1);
	});
}
