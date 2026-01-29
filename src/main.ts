#!/usr/bin/env node

import { Command } from "commander";
import { downloadArtist, downloadTrack } from "./cli/download.js";
import { syncCommand } from "./cli/sync.js";
import { statusCommand } from "./cli/status.js";
import { errorsCommand } from "./cli/errors.js";
import pc from "picocolors";

const program = new Command();

program
	.name("yhdl")
	.description("Download artist discographies from Deezer with intelligent folder management")
	.version("1.9.0")
;

// Download command (existing functionality)
const downloadCmd = program
	.command("download")
	.alias("d")
	.description("Download discography for a specific artist")
	.argument("<artist>", "Artist name to search and download")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.option("--dry-run", "Preview what would be downloaded without actually downloading")
	.action((artist, opts) => {
		// Create a temporary command to pass args
		const tempCmd = new Command();
		tempCmd.args = [artist];
		Object.assign(tempCmd.opts(), opts);
		downloadArtist(tempCmd).catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Track command (download a specific song)
const trackCmd = program
	.command("track")
	.alias("t")
	.description("Download a specific track/song")
	.argument("<track>", "Track name to search and download")
	.argument("[artist]", "Artist name (optional, helps narrow search)")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.option("--dry-run", "Preview what would be downloaded without actually downloading");

trackCmd.action((track, artist) => {
	// Access options from the command instance
	const opts = trackCmd.opts();
	// Create a temporary command to pass args
	const tempCmd = new Command();
	tempCmd.args = [track];
	if (artist) {
		Object.assign(tempCmd.opts(), { artist, ...opts });
	} else {
		Object.assign(tempCmd.opts(), opts);
	}
	downloadTrack(tempCmd).catch((e) => {
		console.error(pc.red("Error:"), e.message);
		process.exit(1);
	});
});

// Sync command (new functionality)
program
	.command("sync")
	.alias("s")
	.description("Sync entire music library - check all artists for new releases")
	.option("--full", "Force check all artists (ignore last check time)")
	.option("--artist <name>", "Sync specific artist only")
	.option("--dry-run", "Preview what would be downloaded without actually downloading")
	.option("-c, --concurrency <n>", "Parallel artist checks", "5")
	.option("--since <hours>", "Only check artists not checked in last N hours", "24")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.action(() => {
		syncCommand().catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Status command
program
	.command("status")
	.alias("st")
	.description("Show sync status and statistics")
	.option("--json", "Output as JSON")
	.action(() => {
		statusCommand().catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Errors command
program
	.command("errors")
	.alias("e")
	.description("View recent sync errors and failures")
	.option("--limit <n>", "Maximum number of errors to show", "20")
	.option("--since <hours>", "Only show errors from last N hours", "24")
	.option("--json", "Output as JSON")
	.action(() => {
		errorsCommand().catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Parse arguments
const args = process.argv.slice(2);

// Backward compatibility: if first arg is not a command and not a flag, treat as artist
const knownCommands = ["download", "d", "track", "t", "sync", "s", "status", "st", "errors", "e"];
if (args.length > 0 && !args[0].startsWith("-") && !knownCommands.includes(args[0])) {
	// Insert "download" command before the artist name
	process.argv = ["node", "yhdl", "download", ...args];
}

program.parse();
