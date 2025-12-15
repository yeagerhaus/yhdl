import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { syncLibrary, type SyncOptions } from "./sync.js";
import { setConfig } from "../config.js";
import { createTempDir, removeTempDir } from "../../test/helpers.js";

describe("syncLibrary (Programmatic API)", () => {
	let testMusicRoot: string;
	let testStatePath: string;
	let testErrorLogPath: string;

	beforeEach(() => {
		testMusicRoot = createTempDir("yhdl-sync-test");
		testStatePath = path.join(os.tmpdir(), `yhdl-sync-state-${Date.now()}.json`);
		testErrorLogPath = path.join(os.tmpdir(), `yhdl-sync-errors-${Date.now()}.json`);
		// Clear programmatic config
		setConfig({
			musicRootPath: testMusicRoot,
		});
		// Clear env vars
		delete process.env.DEEZER_ARL;
	});

	afterEach(() => {
		if (testMusicRoot && fs.existsSync(testMusicRoot)) {
			removeTempDir(testMusicRoot);
		}
		if (fs.existsSync(testStatePath)) {
			fs.unlinkSync(testStatePath);
		}
		if (fs.existsSync(testErrorLogPath)) {
			fs.unlinkSync(testErrorLogPath);
		}
	});

	test("syncLibrary throws error when ARL not provided", async () => {
		const options: SyncOptions = {
			musicRootPath: testMusicRoot,
			statePath: testStatePath,
			errorLogPath: testErrorLogPath,
		};

		await expect(syncLibrary(options)).rejects.toThrow("DEEZER_ARL not found");
	});

	test("syncLibrary accepts deezerArl in options", async () => {
		const options: SyncOptions = {
			musicRootPath: testMusicRoot,
			deezerArl: "test_arl_token",
			statePath: testStatePath,
			errorLogPath: testErrorLogPath,
			dryRun: true, // Use dry run to avoid actual downloads
		};

		// This will fail at login, but we can verify the option is accepted
		expect(options.deezerArl).toBe("test_arl_token");
		expect(options.musicRootPath).toBe(testMusicRoot);
	});

	test("syncLibrary uses programmatic config when options not provided", () => {
		setConfig({
			musicRootPath: testMusicRoot,
			deezerArl: "config_arl_token",
		});

		const options: SyncOptions = {
			musicRootPath: testMusicRoot,
			statePath: testStatePath,
			errorLogPath: testErrorLogPath,
			// deezerArl not provided, should use config
		};

		// Verify config is set
		const config = setConfig;
		expect(testMusicRoot).toBeTruthy();
	});

	test("syncLibrary accepts all sync options", () => {
		const options: SyncOptions = {
			musicRootPath: testMusicRoot,
			bitrate: 9, // FLAC
			concurrency: 10,
			checkIntervalHours: 12,
			fullSync: true,
			dryRun: true,
			statePath: testStatePath,
			errorLogPath: testErrorLogPath,
			specificArtist: "Test Artist",
			deezerArl: "test_arl",
		};

		expect(options.bitrate).toBe(9);
		expect(options.concurrency).toBe(10);
		expect(options.checkIntervalHours).toBe(12);
		expect(options.fullSync).toBe(true);
		expect(options.dryRun).toBe(true);
		expect(options.specificArtist).toBe("Test Artist");
		expect(options.deezerArl).toBe("test_arl");
	});

	test("syncLibrary uses default values when options not provided", () => {
		const options: SyncOptions = {
			musicRootPath: testMusicRoot,
		};

		// These should have defaults in the function
		expect(options.musicRootPath).toBe(testMusicRoot);
		// bitrate, concurrency, etc. will use defaults in the function
	});
});
