#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../config.js";
import { loadState, saveState, clearCheckHistory, clearLibraryCache, clearAllCache } from "../sync/state.js";

const program = new Command();

program
	.name("yhdl-cache")
	.description("Manage sync cache - clear check history, library cache, or both")
	.version("1.0.0")
	.option("--check-history", "Clear check history (lastChecked timestamps)")
	.option("--library", "Clear library scan cache")
	.option("--all", "Clear all cache (check history and library cache)")
	.parse();

export async function cacheCommand() {
	const opts = program.opts<{
		checkHistory?: boolean;
		library?: boolean;
		all?: boolean;
	}>();

	const config = loadConfig();
	const statePath = config.syncStatePath;

	if (!statePath) {
		console.error(pc.red("  ✗ No state path configured"));
		process.exit(1);
	}

	// Load state
	const state = loadState(statePath);

	// Determine what to clear
	const clearHistory = opts.checkHistory || opts.all;
	const clearLib = opts.library || opts.all;

	if (!clearHistory && !clearLib) {
		console.log(pc.yellow("  ⚠ No clear option specified"));
		console.log(pc.dim("    Use --check-history, --library, or --all"));
		program.help();
		process.exit(1);
	}

	// Count before clearing
	const artistCount = Object.keys(state.artists).length;
	const hasLibraryCache = !!state.libraryCache;
	const ignoredCount = state.ignoredArtists?.length || 0;

	// Clear as requested
	if (clearHistory) {
		clearCheckHistory(state);
		console.log(pc.green(`  ✓ Cleared check history for ${artistCount} artist(s)`));
	}

	if (clearLib) {
		clearLibraryCache(state);
		if (hasLibraryCache) {
			console.log(pc.green("  ✓ Cleared library scan cache"));
		} else {
			console.log(pc.dim("  ℹ No library cache to clear"));
		}
	}

	// Save state
	saveState(statePath, state);

	// Show what was preserved
	if (ignoredCount > 0) {
		console.log(pc.dim(`  ℹ Preserved ${ignoredCount} ignored artist(s)`));
	}

	console.log();
	console.log(pc.green("  ✓ Cache cleared successfully"));
}

// Run the command if this file is executed directly
if (import.meta.main) {
	cacheCommand().catch((e) => {
		console.error(pc.red("Error:"), e.message);
		process.exit(1);
	});
}

