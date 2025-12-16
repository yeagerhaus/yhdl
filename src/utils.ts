import { TrackFormats } from "./deezer/types.js";

/**
 * Parse bitrate string or number to TrackFormats enum value
 * Supports: "flac", "320", "mp3_320", "128", "mp3_128", or numeric TrackFormats value
 */
export function parseBitrate(bitrate: number | string | undefined): number {
	if (typeof bitrate === "number") {
		return bitrate;
	}
	if (typeof bitrate === "string") {
		switch (bitrate.toLowerCase()) {
			case "flac":
				return TrackFormats.FLAC;
			case "320":
			case "mp3_320":
				return TrackFormats.MP3_320;
			case "128":
			case "mp3_128":
				return TrackFormats.MP3_128;
			default:
				return TrackFormats.FLAC;
		}
	}
	return TrackFormats.FLAC;
}

