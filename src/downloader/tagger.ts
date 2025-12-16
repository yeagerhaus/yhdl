import NodeID3 from "node-id3";
import fs from "fs";
// @ts-expect-error - flac-metadata doesn't have TypeScript types
import flacMetadata from "flac-metadata";
import type { TrackDownloadInfo } from "./types.js";

export interface TagOptions {
	title?: boolean;
	artist?: boolean;
	album?: boolean;
	trackNumber?: boolean;
	year?: boolean;
	cover?: boolean;
	isrc?: boolean;
}

const DEFAULT_TAG_OPTIONS: TagOptions = {
	title: true,
	artist: true,
	album: true,
	trackNumber: true,
	year: true,
	cover: true,
	isrc: true,
};

export async function tagTrack(
	filePath: string,
	track: TrackDownloadInfo,
	coverPath?: string,
	options: TagOptions = DEFAULT_TAG_OPTIONS
): Promise<void> {
	const extension = filePath.toLowerCase().split(".").pop() || "";

	if (extension === "mp3") {
		await tagMP3(filePath, track, coverPath, options);
	} else if (extension === "flac") {
		await tagFLAC(filePath, track, coverPath, options);
	}
}

async function tagMP3(
	filePath: string,
	track: TrackDownloadInfo,
	coverPath?: string,
	options: TagOptions = DEFAULT_TAG_OPTIONS
): Promise<void> {
	const tags: NodeID3.Tags = {};

	if (options.title && track.title) {
		tags.title = track.title;
	}

	if (options.artist && track.artist) {
		tags.artist = track.artist;
	}

	if (options.album && track.album) {
		tags.album = track.album;
	}

	if (options.trackNumber && track.trackNumber) {
		tags.trackNumber = String(track.trackNumber);
	}

	if (options.year && track.releaseDate) {
		const year = track.releaseDate.split("-")[0];
		if (year) tags.year = year;
	}

	if (options.isrc && track.isrc) {
		tags.ISRC = track.isrc;
	}

	if (options.cover && coverPath && fs.existsSync(coverPath)) {
		try {
			const coverBuffer = fs.readFileSync(coverPath);
			tags.image = {
				mime: "image/jpeg",
				type: { id: 3, name: "front cover" },
				description: "Cover",
				imageBuffer: coverBuffer,
			};
		} catch {
			// Ignore cover errors
		}
	}

	const success = NodeID3.write(tags, filePath);
	if (!success) {
		console.log(`  Warning: Failed to write tags to ${filePath}`);
	}
}

async function tagFLAC(
	filePath: string,
	track: TrackDownloadInfo,
	coverPath?: string,
	options: TagOptions = DEFAULT_TAG_OPTIONS
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		try {
			// Build Vorbis comments array
			const comments: string[] = [];
			
			if (options.title && track.title) {
				comments.push(`TITLE=${track.title}`);
			}
			
			if (options.artist && track.artist) {
				comments.push(`ARTIST=${track.artist}`);
			}
			
			if (options.album && track.album) {
				comments.push(`ALBUM=${track.album}`);
			}
			
			if (options.trackNumber && track.trackNumber) {
				comments.push(`TRACKNUMBER=${track.trackNumber}`);
				if (track.discNumber) {
					comments.push(`DISCNUMBER=${track.discNumber}`);
				}
			}
			
			if (options.year && track.releaseDate) {
				const year = track.releaseDate.split("-")[0];
				if (year) comments.push(`DATE=${year}`);
			}
			
			if (options.isrc && track.isrc) {
				comments.push(`ISRC=${track.isrc}`);
			}
			
			// Read cover art if available
			let coverData: Buffer | undefined;
			if (options.cover && coverPath && fs.existsSync(coverPath)) {
				try {
					coverData = fs.readFileSync(coverPath);
				} catch {
					// Ignore cover errors
				}
			}
			
			// Create temporary file for output
			const tempPath = filePath + ".tmp";
			const reader = fs.createReadStream(filePath);
			const writer = fs.createWriteStream(tempPath);
			const processor = new flacMetadata.Processor();
			
			let mdbVorbis: any;
			let mdbPicture: any;
			const vendor = "reference libFLAC 1.2.1 20070917";
			
			processor.on("preprocess", function (this: any, mdb: any) {
				// Remove existing VORBIS_COMMENT and PICTURE blocks
				if (mdb.type === flacMetadata.Processor.MDB_TYPE_VORBIS_COMMENT) {
					mdb.remove();
				}
				if (mdb.type === flacMetadata.Processor.MDB_TYPE_PICTURE) {
					mdb.remove();
				}
				// Prepare to add new blocks as last metadata block
				if (mdb.isLast) {
					mdb.isLast = false;
					// Create VORBIS_COMMENT block
					if (comments.length > 0) {
						mdbVorbis = flacMetadata.data.MetaDataBlockVorbisComment.create(true, vendor, comments);
					}
					// Create PICTURE block if we have cover art
					if (coverData) {
						mdbPicture = flacMetadata.data.MetaDataBlockPicture.create(
							true, // isLast
							3, // pictureType: Cover (front)
							"image/jpeg", // mimeType
							"Cover", // description
							0, // width
							0, // height
							0, // bitsPerPixel
							0, // colors
							coverData // pictureData
						);
						// If we have both, VORBIS_COMMENT should not be last
						if (mdbVorbis) {
							mdbVorbis.isLast = false;
						}
					}
				}
			});
			
			processor.on("postprocess", function (this: any, mdb: any) {
				// Add new blocks
				if (mdbVorbis) {
					this.push(mdbVorbis.publish());
				}
				if (mdbPicture) {
					this.push(mdbPicture.publish());
				}
			});
			
			writer.on("finish", () => {
				// Replace original file with tagged version
				try {
					fs.renameSync(tempPath, filePath);
					resolve(undefined);
				} catch (error) {
					reject(error);
				}
			});
			
			writer.on("error", (error) => {
				// Clean up temp file on error
				try {
					if (fs.existsSync(tempPath)) {
						fs.unlinkSync(tempPath);
					}
				} catch {
					// Ignore cleanup errors
				}
				reject(error);
			});
			
			reader.pipe(processor).pipe(writer);
		} catch (error) {
			reject(error);
		}
	}).catch((error) => {
		console.log(`  Warning: Failed to write FLAC tags to ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
	});
}

export async function downloadCover(url: string, destPath: string): Promise<boolean> {
	try {
		const got = (await import("got")).default;
		const response = await got(url, {
			responseType: "buffer",
			timeout: { request: 10000 },
		});
		fs.writeFileSync(destPath, response.body);
		return true;
	} catch {
		return false;
	}
}

