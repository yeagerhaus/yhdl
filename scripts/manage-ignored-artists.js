#!/usr/bin/env node

/**
 * Manage ignored artists list
 * Usage:
 *   node manage-ignored-artists.js add "Artist Name"
 *   node manage-ignored-artists.js remove "Artist Name"
 *   node manage-ignored-artists.js list
 *   node manage-ignored-artists.js clear
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeArtistName } from "../src/library/scanner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Find project root by looking for package.json
function getProjectRoot() {
	let currentDir = projectRoot;
	const root = path.parse(currentDir).root;

	while (currentDir !== root) {
		const packageJsonPath = path.join(currentDir, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}

	return projectRoot;
}

const projectRootPath = getProjectRoot();
const statePath = path.join(projectRootPath, ".yhdl", "sync-state.json");

function loadState() {
	if (!fs.existsSync(statePath)) {
		return { artists: {}, version: "1.0.0", ignoredArtists: [] };
	}

	try {
		const content = fs.readFileSync(statePath, "utf-8");
		const state = JSON.parse(content);
		return {
			artists: {},
			version: "1.0.0",
			ignoredArtists: [],
			...state,
		};
	} catch (error) {
		console.error(`Error loading state from ${statePath}:`, error.message);
		return { artists: {}, version: "1.0.0", ignoredArtists: [] };
	}
}

function saveState(state) {
	const dir = path.dirname(statePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	try {
		fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
	} catch (error) {
		console.error(`Error saving state to ${statePath}:`, error.message);
		process.exit(1);
	}
}

function addIgnoredArtist(state, artistName) {
	if (!state.ignoredArtists) {
		state.ignoredArtists = [];
	}

	const normalizedName = normalizeArtistName(artistName);

	// Check if already ignored
	if (state.ignoredArtists.some((ignored) => normalizeArtistName(ignored) === normalizedName)) {
		console.log(`Artist "${artistName}" is already in the ignore list.`);
		return;
	}

	// Add to ignore list
	state.ignoredArtists.push(artistName);
	console.log(`Added "${artistName}" to ignore list.`);
}

function removeIgnoredArtist(state, artistName) {
	if (!state.ignoredArtists || state.ignoredArtists.length === 0) {
		console.log("Ignore list is empty.");
		return;
	}

	const normalizedName = normalizeArtistName(artistName);
	const beforeLength = state.ignoredArtists.length;
	state.ignoredArtists = state.ignoredArtists.filter(
		(ignored) => normalizeArtistName(ignored) !== normalizedName
	);

	if (state.ignoredArtists.length < beforeLength) {
		console.log(`Removed "${artistName}" from ignore list.`);
	} else {
		console.log(`Artist "${artistName}" not found in ignore list.`);
	}
}

function listIgnoredArtists(state) {
	if (!state.ignoredArtists || state.ignoredArtists.length === 0) {
		console.log("No ignored artists.");
		return;
	}

	console.log(`Ignored artists (${state.ignoredArtists.length}):`);
	for (const artist of state.ignoredArtists) {
		console.log(`  - ${artist}`);
	}
}

function clearIgnoredArtists(state) {
	const count = state.ignoredArtists?.length || 0;
	state.ignoredArtists = [];
	console.log(`Cleared ${count} ignored artist(s).`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];
const artistNames = args.slice(1);

if (!command) {
	console.error("Usage:");
	console.error('  node manage-ignored-artists.js add "Artist Name"');
	console.error('  node manage-ignored-artists.js remove "Artist Name"');
	console.error("  node manage-ignored-artists.js list");
	console.error("  node manage-ignored-artists.js clear");
	process.exit(1);
}

const state = loadState();

switch (command) {
	case "add":
		if (artistNames.length === 0) {
			console.error('Error: Please provide at least one artist name.');
			process.exit(1);
		}
		for (const artistName of artistNames) {
			addIgnoredArtist(state, artistName);
		}
		saveState(state);
		break;

	case "remove":
		if (artistNames.length === 0) {
			console.error('Error: Please provide at least one artist name.');
			process.exit(1);
		}
		for (const artistName of artistNames) {
			removeIgnoredArtist(state, artistName);
		}
		saveState(state);
		break;

	case "list":
		listIgnoredArtists(state);
		break;

	case "clear":
		clearIgnoredArtists(state);
		saveState(state);
		break;

	default:
		console.error(`Unknown command: ${command}`);
		console.error("Valid commands: add, remove, list, clear");
		process.exit(1);
}

