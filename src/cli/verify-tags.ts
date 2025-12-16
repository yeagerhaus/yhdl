#!/usr/bin/env bun

import fs from "fs";
import path from "path";
// @ts-expect-error - flac-metadata doesn't have TypeScript types
import flacMetadata from "flac-metadata";

const filePath = process.argv[2] || "D:/MUSIC/Pincer+/Ugly on the Skin/01 - Ugly on the Skin.flac";

if (!fs.existsSync(filePath)) {
	console.error(`File not found: ${filePath}`);
	process.exit(1);
}

console.log(`Reading tags from: ${filePath}\n`);

try {
	const data = fs.readFileSync(filePath);
	const processor = new flacMetadata.Processor({ parseMetaDataBlocks: true });
	
	const tags: Record<string, string> = {};
	let foundVorbisComment = false;

	processor.on("postprocess", function (mdb: any) {
		if (mdb.type === flacMetadata.Processor.MDB_TYPE_VORBIS_COMMENT) {
			foundVorbisComment = true;
			console.log("Vorbis Comment Block Found:");
			console.log(`  Vendor: ${mdb.vendor}`);
			console.log(`  Comments (${mdb.comments.length}):`);
			
			for (const comment of mdb.comments) {
				const [key, ...valueParts] = comment.split("=");
				const value = valueParts.join("=");
				tags[key] = value;
				console.log(`    ${key} = ${value}`);
			}
		}
	});

	// Process the file
	const chunks: Buffer[] = [];
	processor.on("data", (chunk: Buffer) => {
		chunks.push(chunk);
	});

	processor.write(data);
	processor.end();

	if (!foundVorbisComment) {
		console.log("No Vorbis Comment block found in file.");
	} else {
		console.log("\nSummary:");
		console.log(`  RELEASETYPE: ${tags.RELEASETYPE || "NOT FOUND"}`);
		console.log(`  TITLE: ${tags.TITLE || "NOT FOUND"}`);
		console.log(`  ARTIST: ${tags.ARTIST || "NOT FOUND"}`);
		console.log(`  ALBUM: ${tags.ALBUM || "NOT FOUND"}`);
	}
} catch (error) {
	console.error("Error reading file:", error);
	process.exit(1);
}

