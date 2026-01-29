#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "../config.js";
import { loadFailureLog } from "../sync/logger.js";
import pc from "picocolors";

const program = new Command();

program
	.name("yhdl-errors")
	.description("View recent sync errors and failures")
	.version("1.0.0")
	.option("--limit <n>", "Maximum number of errors to show", "20")
	.option("--since <hours>", "Only show errors from last N hours", "24")
	.option("--json", "Output as JSON")
	.parse();

function formatDate(isoString: string): string {
	try {
		const date = new Date(isoString);
		return date.toLocaleString();
	} catch {
		return isoString;
	}
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

export async function errorsCommand() {
	const opts = program.opts<{ limit?: string; since?: string; json?: boolean }>();
	const config = loadConfig();
	
	const limit = parseInt(opts.limit || "20", 10);
	const sinceHours = parseInt(opts.since || "24", 10);
	const sinceTime = Date.now() - sinceHours * 60 * 60 * 1000;
	
	const errorLog = loadFailureLog(config.errorLogPath || ".yhdl/sync-errors.json");
	
	// Filter by time
	const recentErrors = errorLog.filter((entry) => {
		try {
			const timestamp = new Date(entry.timestamp).getTime();
			return timestamp >= sinceTime;
		} catch {
			return false;
		}
	});
	
	// Sort by timestamp (newest first)
	recentErrors.sort((a, b) => {
		try {
			return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
		} catch {
			return 0;
		}
	});
	
	// Limit results
	const displayErrors = recentErrors.slice(0, limit);
	
	if (opts.json) {
		console.log(JSON.stringify(displayErrors, null, 2));
		return;
	}
	
	// Print formatted output
	console.log();
	console.log(pc.bold(pc.magenta("  ╭─────────────────────────────────╮")));
	console.log(pc.bold(pc.magenta("  │")) + pc.bold(pc.white("    ⚠ Recent Errors            ")) + pc.bold(pc.magenta("│")));
	console.log(pc.bold(pc.magenta("  ╰─────────────────────────────────╯")));
	console.log();
	
	if (displayErrors.length === 0) {
		console.log(pc.green("  ✓ No errors found in the last " + sinceHours + " hours"));
		console.log();
		return;
	}
	
	console.log(pc.dim(`  Showing ${displayErrors.length} of ${recentErrors.length} recent errors (last ${sinceHours}h)`));
	console.log();
	
	for (let i = 0; i < displayErrors.length; i++) {
		const error = displayErrors[i];
		const timeAgo = formatDuration(Date.now() - new Date(error.timestamp).getTime());
		
		console.log(pc.dim(`  ┌─ Error #${i + 1} (${timeAgo}) ─────────────────────`));
		console.log(pc.dim("  │ ") + pc.cyan("Type:     ") + pc.white(error.type));
		console.log(pc.dim("  │ ") + pc.cyan("Artist:   ") + pc.white(error.artist));
		if (error.release) {
			console.log(pc.dim("  │ ") + pc.cyan("Release:  ") + pc.white(error.release));
		}
		console.log(pc.dim("  │ ") + pc.cyan("Error:    ") + pc.red(error.error));
		console.log(pc.dim("  │ ") + pc.cyan("Time:     ") + pc.dim(formatDate(error.timestamp)));
		console.log(pc.dim("  └───────────────────────────────────────────"));
		console.log();
	}
	
	if (recentErrors.length > limit) {
		console.log(pc.dim(`  ... and ${recentErrors.length - limit} more errors`));
		console.log();
	}
}

// Run the command if this file is executed directly
if (import.meta.main) {
	errorsCommand().catch((e) => {
		console.error(pc.red("Error:"), e.message);
		process.exit(1);
	});
}

