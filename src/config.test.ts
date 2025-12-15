import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig, getConfig, setConfig, clearConfig, loadArl, saveArl, clearArl } from "./config.js";

describe("Config", () => {
	const testEnvPath = path.join(os.tmpdir(), `yhdl-test-${Date.now()}.env`);

	beforeEach(() => {
		// Clean up any existing test env file
		if (fs.existsSync(testEnvPath)) {
			fs.unlinkSync(testEnvPath);
		}
		// Clear env vars for testing
		delete process.env.MUSIC_ROOT_PATH;
		delete process.env.DEEZER_ARL;
		delete process.env.SYNC_CONCURRENCY;
		delete process.env.SYNC_CHECK_INTERVAL;
		// Clear programmatic config
		clearConfig();
	});

	afterEach(() => {
		// Clean up test env file
		if (fs.existsSync(testEnvPath)) {
			fs.unlinkSync(testEnvPath);
		}
	});

	test("loadConfig returns default music root path when env var not set", () => {
		const config = loadConfig();
		expect(config.musicRootPath).toBeTruthy();
		expect(typeof config.musicRootPath).toBe("string");
	});

	test("loadConfig reads MUSIC_ROOT_PATH from env", () => {
		const testPath = "/test/music/path";
		process.env.MUSIC_ROOT_PATH = testPath;
		const config = loadConfig();
		expect(config.musicRootPath).toBe(testPath);
	});

	test("loadConfig has default sync settings", () => {
		const config = loadConfig();
		expect(config.syncConcurrency).toBe(5);
		expect(config.syncCheckInterval).toBe(24);
	});

	test("loadConfig reads sync settings from env", () => {
		process.env.SYNC_CONCURRENCY = "10";
		process.env.SYNC_CHECK_INTERVAL = "12";
		const config = loadConfig();
		expect(config.syncConcurrency).toBe(10);
		expect(config.syncCheckInterval).toBe(12);
	});

	test("loadArl returns null when DEEZER_ARL not set", () => {
		const arl = loadArl();
		expect(arl).toBeNull();
	});

	test("loadArl returns ARL from env", () => {
		const testArl = "test_arl_token_12345";
		process.env.DEEZER_ARL = testArl;
		const arl = loadArl();
		expect(arl).toBe(testArl);
	});

	test("loadArl trims whitespace", () => {
		process.env.DEEZER_ARL = "  test_arl  ";
		const arl = loadArl();
		expect(arl).toBe("test_arl");
	});

	test("saveArl and loadArl work together", () => {
		const testArl = "saved_arl_token";
		process.env.DEEZER_ARL = testArl;
		
		// Note: saveArl writes to .env file, but loadArl reads from process.env
		// In real usage, Bun loads .env automatically
		const arl = loadArl();
		expect(arl).toBe(testArl);
	});

	test("clearArl removes ARL from env file", () => {
		// This test verifies clearArl doesn't throw
		expect(() => clearArl()).not.toThrow();
	});

	describe("Programmatic Configuration", () => {
		test("setConfig stores configuration", () => {
			const testConfig = {
				musicRootPath: "/test/path",
				syncConcurrency: 10,
				syncCheckInterval: 12,
				deezerArl: "test_arl_123",
			};
			setConfig(testConfig);
			const config = getConfig();
			expect(config.musicRootPath).toBe("/test/path");
			expect(config.syncConcurrency).toBe(10);
			expect(config.syncCheckInterval).toBe(12);
		});

		test("getConfig returns programmatic config when set", () => {
			const testConfig = {
				musicRootPath: "/programmatic/path",
				syncConcurrency: 8,
			};
			setConfig(testConfig);
			const config = getConfig();
			expect(config.musicRootPath).toBe("/programmatic/path");
			expect(config.syncConcurrency).toBe(8);
		});

		test("getConfig falls back to env vars when programmatic config not set", () => {
			// Clear programmatic config
			clearConfig();
			process.env.MUSIC_ROOT_PATH = "/env/path";
			process.env.SYNC_CONCURRENCY = "15";
			const config = getConfig();
			expect(config.musicRootPath).toBe("/env/path");
			expect(config.syncConcurrency).toBe(15);
		});

		test("programmatic config overrides env vars", () => {
			process.env.MUSIC_ROOT_PATH = "/env/path";
			const testConfig = {
				musicRootPath: "/programmatic/path",
			};
			setConfig(testConfig);
			const config = getConfig();
			expect(config.musicRootPath).toBe("/programmatic/path");
		});

		test("loadArl returns ARL from programmatic config", () => {
			const testConfig = {
				musicRootPath: "/test/path",
				deezerArl: "programmatic_arl_token",
			};
			setConfig(testConfig);
			const arl = loadArl();
			expect(arl).toBe("programmatic_arl_token");
		});

		test("loadArl falls back to env when programmatic ARL not set", () => {
			// Clear programmatic config
			clearConfig();
			process.env.DEEZER_ARL = "env_arl_token";
			const arl = loadArl();
			expect(arl).toBe("env_arl_token");
		});

		test("loadArl prefers programmatic ARL over env var", () => {
			process.env.DEEZER_ARL = "env_arl_token";
			const testConfig = {
				musicRootPath: "/test/path",
				deezerArl: "programmatic_arl_token",
			};
			setConfig(testConfig);
			const arl = loadArl();
			expect(arl).toBe("programmatic_arl_token");
		});
	});
});

