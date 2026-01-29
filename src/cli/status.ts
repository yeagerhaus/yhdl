#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig, loadArl } from "../config.js";
import { loadState } from "../sync/state.js";
import { loadFailureLog } from "../sync/logger.js";
import { Deezer } from "../deezer/index.js";
import pc from "picocolors";
import fs from "fs";

const program = new Command();

program
	.name("yhdl-status")
	.description("Show sync status and statistics")
	.version("1.0.0")
	.option("--json", "Output as JSON")
	.parse();

interface StatusInfo {
	config: {
		musicRootPath: string;
		arlConfigured: boolean;
		arlValid: boolean;
		arlUserName?: string;
	};
	state: {
		totalArtists: number;
		lastFullSync?: string;
		ignoredArtists: number;
		artistsCheckedInLast24h: number;
		artistsCheckedInLast7d: number;
	};
	errors: {
		total: number;
		recent: number; // Last 24 hours
	};
	library: {
		cached: boolean;
		lastScanned?: string;
		artistsInCache?: number;
	};
}

async function getStatus(): Promise<StatusInfo> {
	const config = loadConfig();
	const state = loadState(config.syncStatePath || ".yhdl/sync-state.json");
	const errorLog = loadFailureLog(config.errorLogPath || ".yhdl/sync-errors.json");
	
	// Check ARL
	const arl = loadArl();
	let arlValid = false;
	let arlUserName: string | undefined;
	
	if (arl) {
		try {
			const dz = new Deezer();
			arlValid = await dz.loginViaArl(arl);
			if (arlValid && dz.currentUser) {
				arlUserName = dz.currentUser.name;
			}
		} catch {
			arlValid = false;
		}
	}
	
	// Calculate artist stats
	const now = Date.now();
	const oneDayAgo = now - 24 * 60 * 60 * 1000;
	const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
	
	let artistsCheckedInLast24h = 0;
	let artistsCheckedInLast7d = 0;
	
	for (const artistId in state.artists) {
		const artist = state.artists[artistId];
		if (artist.lastChecked) {
			try {
				const lastChecked = new Date(artist.lastChecked).getTime();
				if (lastChecked >= oneDayAgo) {
					artistsCheckedInLast24h++;
				}
				if (lastChecked >= sevenDaysAgo) {
					artistsCheckedInLast7d++;
				}
			} catch {
				// Invalid date, skip
			}
		}
	}
	
	// Calculate recent errors (last 24 hours)
	const recentErrors = errorLog.filter((entry) => {
		try {
			const timestamp = new Date(entry.timestamp).getTime();
			return timestamp >= oneDayAgo;
		} catch {
			return false;
		}
	});
	
	// Library cache info
	const libraryCache = state.libraryCache;
	const libraryCached = libraryCache !== undefined && 
		libraryCache.musicRootPath === config.musicRootPath;
	
	return {
		config: {
			musicRootPath: config.musicRootPath,
			arlConfigured: !!arl,
			arlValid,
			arlUserName,
		},
		state: {
			totalArtists: Object.keys(state.artists).length,
			lastFullSync: state.lastFullSync,
			ignoredArtists: state.ignoredArtists?.length || 0,
			artistsCheckedInLast24h,
			artistsCheckedInLast7d,
		},
		errors: {
			total: errorLog.length,
			recent: recentErrors.length,
		},
		library: {
			cached: libraryCached,
			lastScanned: libraryCache?.lastScanned,
			artistsInCache: libraryCache?.artists.length,
		},
	};
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	
	if (days > 0) return `${days}d ${hours % 24}h ago`;
	if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return `${seconds}s ago`;
}

function formatDate(isoString?: string): string {
	if (!isoString) return "Never";
	try {
		const date = new Date(isoString);
		const now = Date.now();
		const diff = now - date.getTime();
		return formatDuration(diff);
	} catch {
		return "Invalid date";
	}
}

function printStatus(status: StatusInfo) {
	console.log();
	console.log(pc.bold(pc.magenta("  ╭─────────────────────────────────╮")));
	console.log(pc.bold(pc.magenta("  │")) + pc.bold(pc.white("    📊 Sync Status              ")) + pc.bold(pc.magenta("│")));
	console.log(pc.bold(pc.magenta("  ╰─────────────────────────────────╯")));
	console.log();
	
	// Config section
	console.log(pc.dim("  ┌─ Configuration ──────────────────────────"));
	console.log(pc.dim("  │ ") + pc.cyan("Music Root: ") + pc.white(status.config.musicRootPath));
	console.log(pc.dim("  │ ") + pc.cyan("ARL Token:  ") + 
		(status.config.arlConfigured 
			? (status.config.arlValid 
				? pc.green(`✓ Valid (${status.config.arlUserName || "Unknown"})`)
				: pc.red("✗ Invalid or expired"))
			: pc.yellow("⚠ Not configured")));
	console.log(pc.dim("  └───────────────────────────────────────────"));
	console.log();
	
	// State section
	console.log(pc.dim("  ┌─ Sync State ──────────────────────────────"));
	console.log(pc.dim("  │ ") + pc.cyan("Total Artists:     ") + pc.white(String(status.state.totalArtists).padStart(4)));
	console.log(pc.dim("  │ ") + pc.cyan("Ignored Artists:   ") + pc.white(String(status.state.ignoredArtists).padStart(4)));
	console.log(pc.dim("  │ ") + pc.cyan("Checked (24h):     ") + pc.white(String(status.state.artistsCheckedInLast24h).padStart(4)));
	console.log(pc.dim("  │ ") + pc.cyan("Checked (7d):      ") + pc.white(String(status.state.artistsCheckedInLast7d).padStart(4)));
	console.log(pc.dim("  │ ") + pc.cyan("Last Full Sync:    ") + pc.white(formatDate(status.state.lastFullSync)));
	console.log(pc.dim("  └───────────────────────────────────────────"));
	console.log();
	
	// Library section
	console.log(pc.dim("  ┌─ Library Cache ───────────────────────────"));
	console.log(pc.dim("  │ ") + pc.cyan("Cached:            ") + 
		(status.library.cached ? pc.green("✓ Yes") : pc.yellow("✗ No")));
	if (status.library.cached) {
		console.log(pc.dim("  │ ") + pc.cyan("Artists in Cache:   ") + pc.white(String(status.library.artistsInCache || 0).padStart(4)));
		console.log(pc.dim("  │ ") + pc.cyan("Last Scanned:      ") + pc.white(formatDate(status.library.lastScanned)));
	}
	console.log(pc.dim("  └───────────────────────────────────────────"));
	console.log();
	
	// Errors section
	console.log(pc.dim("  ┌─ Errors ──────────────────────────────────"));
	console.log(pc.dim("  │ ") + pc.cyan("Total Errors:       ") + 
		(status.errors.total > 0 ? pc.red(String(status.errors.total).padStart(4)) : pc.green(String(status.errors.total).padStart(4))));
	console.log(pc.dim("  │ ") + pc.cyan("Recent (24h):       ") + 
		(status.errors.recent > 0 ? pc.red(String(status.errors.recent).padStart(4)) : pc.green(String(status.errors.recent).padStart(4))));
	console.log(pc.dim("  └───────────────────────────────────────────"));
	console.log();
}

export async function statusCommand() {
	const opts = program.opts<{ json?: boolean }>();
	
	try {
		const status = await getStatus();
		
		if (opts.json) {
			console.log(JSON.stringify(status, null, 2));
		} else {
			printStatus(status);
		}
	} catch (error) {
		console.error(pc.red("Error:"), error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

// Run the command if this file is executed directly
if (import.meta.main) {
	statusCommand().catch((e) => {
		console.error(pc.red("Error:"), e.message);
		process.exit(1);
	});
}

