#!/usr/bin/env bun

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { tagTrack } from "../downloader/tagger.js";
import type { TrackDownloadInfo } from "../downloader/types.js";
import { determineReleaseType } from "../folder-resolver.js";
import type { DiscographyAlbum } from "../deezer/types.js";
import pc from "picocolors";

const program = new Command();

program
	.name("tag-existing")
	.description("Add RELEASETYPE metadata tags to existing FLAC/MP3 files")
	.option("-p, --path <path>", "Music root path (required)", process.cwd())
	.option("--dry-run", "Preview what would be tagged without making changes")
	.action(async (options) => {
		const musicRootPath = options.path || process.cwd();
		const dryRun = options.dryRun || false;

		if (!fs.existsSync(musicRootPath)) {
			console.error(pc.red(`Error: Path does not exist: ${musicRootPath}`));
			process.exit(1);
		}

		console.log(pc.cyan("Tagging existing files with RELEASETYPE metadata..."));
		console.log(pc.dim(`  Path: ${musicRootPath}`));
		if (dryRun) {
			console.log(pc.yellow("  DRY RUN MODE - No changes will be made"));
		}
		console.log();

		let filesProcessed = 0;
		let filesTagged = 0;
		let filesSkipped = 0;
		let errors = 0;

		// Collect all album directories first
		const albumDirs: string[] = [];

		// Walk through the directory structure to find album directories
		function findAlbumDirs(dir: string, depth: number = 0): void {
			if (depth > 5) return; // Safety limit

			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				let hasAudioFiles = false;

				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);

					if (entry.isDirectory()) {
						// Recursively check subdirectories
						findAlbumDirs(fullPath, depth + 1);
					} else if (entry.isFile()) {
						const ext = path.extname(entry.name).toLowerCase();
						if (ext === ".flac" || ext === ".mp3") {
							hasAudioFiles = true;
						}
					}
				}

				// If this directory has audio files directly in it, it's an album directory
				// Skip the root directory (depth 0) to avoid treating the entire music root as an album
				if (hasAudioFiles && depth > 0) {
					albumDirs.push(dir);
				}
			} catch (error) {
				// Skip directories we can't read
			}
		}

		async function processFile(
			filePath: string,
			albumDir: string,
			trackCount: number,
			dryRun: boolean
		): Promise<void> {
			try {
				// Extract track info from filename (format: "01 - Track Name.ext")
				const filename = path.basename(filePath, path.extname(filePath));
				const trackMatch = filename.match(/^(\d+)\s*-\s*(.+)$/);
				
				if (!trackMatch) {
					filesSkipped++;
					return;
				}

				const trackNumber = parseInt(trackMatch[1], 10);
				const trackTitle = trackMatch[2].trim();

				// Extract artist and album from directory structure
				// Expected: MusicRoot/Artist/Album/Track.ext
				// Or: Artist/Album/Track.ext (if pointing directly at artist folder)
				const relativePath = path.relative(musicRootPath, albumDir);
				const parts = relativePath.split(path.sep).filter((p) => p.length > 0);
				
				// If we're at the root or only one level deep, use the directory name as album
				// and try to get artist from parent, otherwise use "Unknown Artist"
				let artistName: string;
				let albumName: string;
				
				if (parts.length >= 2) {
					// Standard structure: Artist/Album
					artistName = parts[0];
					albumName = parts[parts.length - 1];
				} else if (parts.length === 1) {
					// Only album level - try to get artist from parent directory
					const parentDir = path.dirname(albumDir);
					artistName = path.basename(parentDir) || "Unknown Artist";
					albumName = parts[0];
				} else {
					// At root - skip
					filesSkipped++;
					return;
				}

				// Create a mock album object to use determineReleaseType
				const mockAlbum: DiscographyAlbum = {
					id: "0",
					title: albumName,
					nb_tracks: trackCount,
					record_type: trackCount <= 2 ? "single" : trackCount <= 6 ? "ep" : "album",
				} as DiscographyAlbum;

				const releaseType = determineReleaseType(mockAlbum);

				// Create track info
				const trackInfo: TrackDownloadInfo = {
					id: 0,
					title: trackTitle,
					artist: artistName,
					album: albumName,
					trackNumber,
					discNumber: 1,
					duration: 0,
					isrc: "",
					explicit: false,
					md5Origin: 0,
					mediaVersion: 0,
					trackToken: "",
					albumCover: "",
					releaseType,
				};

				// Check for cover art
				const coverPath = path.join(albumDir, "cover.jpg");
				const finalCoverPath = fs.existsSync(coverPath) ? coverPath : undefined;

				if (dryRun) {
					console.log(
						pc.dim("  [DRY RUN] Would tag: ") +
							pc.cyan(path.relative(musicRootPath, filePath)) +
							pc.dim(` with RELEASETYPE=${releaseType.toLowerCase()}`)
					);
					filesTagged++;
				} else {
					// Tag the file
					await tagTrack(filePath, trackInfo, finalCoverPath, {
						title: false, // Don't overwrite existing tags
						artist: false,
						album: false,
						trackNumber: false,
						year: false,
						cover: false,
						isrc: false,
						releaseType: true, // Only add RELEASETYPE
					});
					console.log(
						pc.green("  ✓ Tagged: ") +
							pc.cyan(path.relative(musicRootPath, filePath)) +
							pc.dim(` (${releaseType})`)
					);
					filesTagged++;
				}
			} catch (error) {
				errors++;
				console.error(
					pc.red(`  ✗ Error tagging ${path.relative(musicRootPath, filePath)}: `) +
						(error instanceof Error ? error.message : String(error))
				);
			}
		}

		// Find all album directories
		findAlbumDirs(musicRootPath);

		// Process each album directory
		for (const albumDir of albumDirs) {
			// Count audio files in this directory
			const audioFiles = fs.readdirSync(albumDir).filter((f) => {
				const ext = path.extname(f).toLowerCase();
				return ext === ".flac" || ext === ".mp3";
			});
			const trackCount = audioFiles.length;

			// Process each audio file in the directory
			for (const file of audioFiles) {
				const filePath = path.join(albumDir, file);
				filesProcessed++;
				await processFile(filePath, albumDir, trackCount, dryRun);
			}
		}

		console.log();
		console.log(pc.cyan("Summary:"));
		console.log(`  Files processed: ${filesProcessed}`);
		console.log(`  Files ${dryRun ? "would be " : ""}tagged: ${filesTagged}`);
		console.log(`  Files skipped: ${filesSkipped}`);
		if (errors > 0) {
			console.log(pc.red(`  Errors: ${errors}`));
		}
	});

program.parse();

