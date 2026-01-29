import got from "got";
import pc from "picocolors";

export interface PlexWebhookOptions {
	url: string;
	token?: string;
}

/**
 * Trigger Plex library scan via webhook
 * This can be used to automatically refresh Plex after downloads complete
 */
export async function triggerPlexScan(options: PlexWebhookOptions): Promise<boolean> {
	try {
		const url = new URL(options.url);
		
		// Add token if provided
		if (options.token) {
			url.searchParams.set("X-Plex-Token", options.token);
		}
		
		// Plex webhook format: POST to /library/sections/{section}/refresh
		// Or use a generic webhook URL that triggers a scan
		const response = await got.post(url.toString(), {
			timeout: {
				request: 5000, // 5 second timeout
			},
			retry: {
				limit: 0, // Don't retry
			},
		});
		
		return response.statusCode >= 200 && response.statusCode < 300;
	} catch (error) {
		console.error(pc.dim(`  ⚠ Plex webhook failed: ${error instanceof Error ? error.message : String(error)}`));
		return false;
	}
}

/**
 * Format Plex webhook payload for new releases
 */
export function formatPlexWebhookPayload(releases: Array<{ artist: string; release: string; releaseDate?: string; tracks: number }>): object {
	return {
		event: "library.new.content",
		releases: releases.map((r) => ({
			artist: r.artist,
			release: r.release,
			releaseDate: r.releaseDate,
			tracks: r.tracks,
		})),
		timestamp: new Date().toISOString(),
	};
}

