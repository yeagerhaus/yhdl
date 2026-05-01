import { TrackFormats } from "./deezer/types.js";

export function sanitizeFilename(name: string): string {
	return name
		.replace(/[<>:"/\\|?*]/g, "_")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) return `${days}d ${hours % 24}h ago`;
	if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return `${seconds}s ago`;
}

export function parseBitrate(bitrate: number | string | undefined): number {
	if (typeof bitrate === "number") {
		return bitrate;
	}
	if (typeof bitrate === "string") {
		switch (bitrate.toLowerCase()) {
			case "flac":
				return TrackFormats.FLAC;
			case "mp3":
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
