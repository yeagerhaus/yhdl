#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { downloadArtist, downloadTrack } from "./cli/download.js";
import { errorsCommand } from "./cli/errors.js";
import { statusCommand } from "./cli/status.js";
import type { SyncCommandOpts } from "./cli/sync.js";
import { syncCommand } from "./cli/sync.js";

const program = new Command();

program
	.name("yhdl")
	.description(
		"Download artist discographies from Deezer with intelligent folder management",
	)
	.version("1.10.0");

// Download command (existing functionality)
program
	.command("download")
	.alias("d")
	.description("Download discography for a specific artist")
	.argument("<artist>", "Artist name to search and download")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.option(
		"--dry-run",
		"Preview what would be downloaded without actually downloading",
	)
	.action((artist, opts) => {
		downloadArtist(artist, opts).catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Track command (download a specific song)
program
	.command("track")
	.alias("t")
	.description("Download a specific track/song")
	.argument("<track>", "Track name to search and download")
	.argument("[artist]", "Artist name (optional, helps narrow search)")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.option(
		"--dry-run",
		"Preview what would be downloaded without actually downloading",
	)
	.action((track, artist, opts) => {
		downloadTrack(track, { artist, ...opts }).catch((e) => {
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
	.action((opts: SyncCommandOpts) => {
		syncCommand(opts).catch((e) => {
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
	.action((opts: { json?: boolean }) => {
		statusCommand(opts).catch((e) => {
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
	.action((opts: { limit?: string; since?: string; json?: boolean }) => {
		errorsCommand(opts).catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Parse arguments
const args = process.argv.slice(2);

// Backward compatibility: if first arg is not a command and not a flag, treat as artist
const knownCommands = [
	"download",
	"d",
	"track",
	"t",
	"sync",
	"s",
	"status",
	"st",
	"errors",
	"e",
];
if (
	args.length > 0 &&
	!args[0].startsWith("-") &&
	!knownCommands.includes(args[0])
) {
	// Insert "download" command before the artist name
	process.argv = ["node", "yhdl", "download", ...args];
}

program.parse();
