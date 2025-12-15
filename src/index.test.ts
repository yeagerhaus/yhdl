import { describe, test, expect } from "bun:test";

/**
 * Test that all library exports are available
 * This ensures the library API is properly exposed
 */
describe("Library Exports", () => {
	test("exports syncLibrary and types", async () => {
		const lib = await import("./index.js");
		expect(lib.syncLibrary).toBeDefined();
		expect(typeof lib.syncLibrary).toBe("function");
		// Types are compile-time only, but we can check the function exists
	});

	test("exports downloadArtist and types", async () => {
		const lib = await import("./index.js");
		expect(lib.downloadArtist).toBeDefined();
		expect(typeof lib.downloadArtist).toBe("function");
	});

	test("exports scanLibrary", async () => {
		const lib = await import("./index.js");
		expect(lib.scanLibrary).toBeDefined();
		expect(typeof lib.scanLibrary).toBe("function");
	});

	test("exports setConfig and getConfig", async () => {
		const lib = await import("./index.js");
		expect(lib.setConfig).toBeDefined();
		expect(lib.getConfig).toBeDefined();
		expect(typeof lib.setConfig).toBe("function");
		expect(typeof lib.getConfig).toBe("function");
	});

	test("exports Config type", async () => {
		const lib = await import("./index.js");
		// Types are compile-time only, but we can verify functions that use them exist
		expect(lib.setConfig).toBeDefined();
	});

	test("exports SyncOptions and SyncResult types", async () => {
		const lib = await import("./index.js");
		// Verify syncLibrary exists which uses these types
		expect(lib.syncLibrary).toBeDefined();
	});

	test("exports DownloadArtistOptions and DownloadArtistResult types", async () => {
		const lib = await import("./index.js");
		// Verify downloadArtist exists which uses these types
		expect(lib.downloadArtist).toBeDefined();
	});

	test("exports Deezer and TrackFormats", async () => {
		const lib = await import("./index.js");
		expect(lib.Deezer).toBeDefined();
		expect(lib.TrackFormats).toBeDefined();
		expect(typeof lib.TrackFormats).toBe("object");
	});

	test("exports all config functions", async () => {
		const lib = await import("./index.js");
		expect(lib.loadConfig).toBeDefined();
		expect(lib.getConfig).toBeDefined();
		expect(lib.setConfig).toBeDefined();
		expect(lib.loadArl).toBeDefined();
		expect(lib.saveArl).toBeDefined();
		expect(lib.clearArl).toBeDefined();
	});
});
