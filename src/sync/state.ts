import fs from "fs";
import path from "path";
import type { SyncState, ArtistState, LibraryCache } from "./types.js";
import { normalizeArtistName } from "../library/scanner.js";

const DEFAULT_STATE: SyncState = {
	artists: {},
	version: "1.0.0",
};

/**
 * Load sync state from JSON file
 */
export function loadState(statePath: string): SyncState {
	if (!fs.existsSync(statePath)) {
		return { ...DEFAULT_STATE };
	}

	try {
		const content = fs.readFileSync(statePath, "utf-8");
		const state = JSON.parse(content) as SyncState;

		// Validate structure
		if (!state.artists || typeof state.artists !== "object") {
			return { ...DEFAULT_STATE };
		}

		return {
			...DEFAULT_STATE,
			...state,
			artists: state.artists || {},
		};
	} catch (error) {
		console.error(`Error loading state from ${statePath}:`, error);
		return { ...DEFAULT_STATE };
	}
}

/**
 * Save sync state to JSON file
 */
export function saveState(statePath: string, state: SyncState): void {
	const dir = path.dirname(statePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	try {
		fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
	} catch (error) {
		console.error(`Error saving state to ${statePath}:`, error);
		throw error;
	}
}

/**
 * Update artist check timestamp
 */
export function updateArtistCheck(
	state: SyncState,
	artistId: number,
	artistName: string,
	timestamp: Date = new Date()
): void {
	state.artists[artistId] = {
		name: artistName,
		lastChecked: timestamp.toISOString(),
		deezerId: artistId,
		...(state.artists[artistId] || {}),
	};
}

/**
 * Update artist's last release date
 */
export function updateArtistLastRelease(
	state: SyncState,
	artistId: number,
	releaseDate: string
): void {
	if (!state.artists[artistId]) {
		state.artists[artistId] = {
			name: "",
			lastChecked: new Date().toISOString(),
			deezerId: artistId,
		};
	}
	state.artists[artistId].lastReleaseDate = releaseDate;
}

/**
 * Get last check timestamp for an artist
 */
export function getLastCheck(state: SyncState, artistId: number): Date | null {
	const artist = state.artists[artistId];
	if (!artist || !artist.lastChecked) {
		return null;
	}

	try {
		return new Date(artist.lastChecked);
	} catch {
		return null;
	}
}

/**
 * Check if artist should be skipped (checked recently)
 */
export function shouldSkipArtist(
	state: SyncState,
	artistId: number,
	checkIntervalHours: number
): boolean {
	const lastCheck = getLastCheck(state, artistId);
	if (!lastCheck) {
		return false;
	}

	const hoursSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);
	return hoursSinceCheck < checkIntervalHours;
}

/**
 * Get all artist IDs from state
 */
export function getAllArtistIds(state: SyncState): number[] {
	return Object.keys(state.artists)
		.map((id) => parseInt(id, 10))
		.filter((id) => !isNaN(id));
}

/**
 * Update last full sync timestamp
 */
export function updateLastFullSync(state: SyncState, timestamp: Date = new Date()): void {
	state.lastFullSync = timestamp.toISOString();
}

/**
 * Cache library scan results
 */
export function cacheLibraryScan(
	state: SyncState,
	musicRootPath: string,
	artists: Array<{ name: string; path: string }>
): void {
	state.libraryCache = {
		artists,
		lastScanned: new Date().toISOString(),
		musicRootPath,
	};
}

/**
 * Get cached library scan if still valid
 * Returns null if cache is invalid or doesn't exist
 */
export function getCachedLibraryScan(
	state: SyncState,
	musicRootPath: string,
	maxAgeHours: number = 24
): LibraryCache | null {
	const cache = state.libraryCache;
	if (!cache) {
		return null;
	}

	// Check if cache is for the same music root path
	if (cache.musicRootPath !== musicRootPath) {
		return null;
	}

	// Check if cache is still fresh
	try {
		const lastScanned = new Date(cache.lastScanned);
		const hoursSinceScan = (Date.now() - lastScanned.getTime()) / (1000 * 60 * 60);
		
		if (hoursSinceScan > maxAgeHours) {
			return null; // Cache expired
		}

		return cache;
	} catch {
		return null; // Invalid date
	}
}

/**
 * Cache existing releases for an artist
 */
export function cacheArtistReleases(
	state: SyncState,
	artistId: number,
	releaseFolderNames: string[]
): void {
	if (!state.artists[artistId]) {
		state.artists[artistId] = {
			name: "",
			lastChecked: new Date().toISOString(),
			deezerId: artistId,
		};
	}
	state.artists[artistId].existingReleases = releaseFolderNames;
}

/**
 * Get cached existing releases for an artist
 */
export function getCachedArtistReleases(
	state: SyncState,
	artistId: number
): string[] | null {
	const artist = state.artists[artistId];
	return artist?.existingReleases || null;
}

/**
 * Check if an artist is in the ignore list
 */
export function isArtistIgnored(state: SyncState, artistName: string): boolean {
	if (!state.ignoredArtists || state.ignoredArtists.length === 0) {
		return false;
	}

	const normalizedName = normalizeArtistName(artistName);
	return state.ignoredArtists.some(
		(ignored) => normalizeArtistName(ignored) === normalizedName
	);
}

/**
 * Add an artist to the ignore list
 */
export function addIgnoredArtist(state: SyncState, artistName: string): void {
	if (!state.ignoredArtists) {
		state.ignoredArtists = [];
	}

	const normalizedName = normalizeArtistName(artistName);
	
	// Check if already ignored
	if (state.ignoredArtists.some((ignored) => normalizeArtistName(ignored) === normalizedName)) {
		return; // Already ignored
	}

	// Add to ignore list (store original name for readability)
	state.ignoredArtists.push(artistName);
}

/**
 * Remove an artist from the ignore list
 */
export function removeIgnoredArtist(state: SyncState, artistName: string): void {
	if (!state.ignoredArtists || state.ignoredArtists.length === 0) {
		return;
	}

	const normalizedName = normalizeArtistName(artistName);
	state.ignoredArtists = state.ignoredArtists.filter(
		(ignored) => normalizeArtistName(ignored) !== normalizedName
	);
}

/**
 * Get all ignored artists
 */
export function getIgnoredArtists(state: SyncState): string[] {
	return state.ignoredArtists || [];
}

