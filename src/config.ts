import fs from "fs";
import path from "path";
import os from "os";

export interface Config {
	musicRootPath: string;
}

const DEFAULT_CONFIG: Config = {
	musicRootPath: path.join(os.homedir(), "Music"),
};

/**
 * Get the config directory path
 */
export function getConfigDir(): string {
	return path.join(os.homedir(), ".config", "yhdl");
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
	return path.join(getConfigDir(), "config.json");
}

/**
 * Get the ARL file path
 */
export function getArlPath(): string {
	return path.join(getConfigDir(), ".arl");
}

/**
 * Load config from ~/.config/yhdl/config.json
 * Creates default config if it doesn't exist
 */
export function loadConfig(): Config {
	const configDir = getConfigDir();
	const configPath = getConfigPath();

	// Create config directory if it doesn't exist
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}

	// Create default config if it doesn't exist
	if (!fs.existsSync(configPath)) {
		saveConfig(DEFAULT_CONFIG);
		console.log(`Created default config at: ${configPath}`);
		console.log(`Please edit the config to set your music root path.`);
		return DEFAULT_CONFIG;
	}

	try {
		const configData = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(configData) as Partial<Config>;

		// Merge with defaults
		return {
			...DEFAULT_CONFIG,
			...config,
		};
	} catch (e) {
		console.error("Error loading config, using defaults:", e);
		return DEFAULT_CONFIG;
	}
}

/**
 * Save config to file
 */
export function saveConfig(config: Config): void {
	const configPath = getConfigPath();
	const configDir = getConfigDir();

	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}

	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Load ARL from file
 */
export function loadArl(): string | null {
	const arlPath = getArlPath();

	if (!fs.existsSync(arlPath)) {
		return null;
	}

	try {
		return fs.readFileSync(arlPath, "utf-8").trim();
	} catch {
		return null;
	}
}

/**
 * Save ARL to file
 */
export function saveArl(arl: string): void {
	const arlPath = getArlPath();
	const configDir = getConfigDir();

	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}

	fs.writeFileSync(arlPath, arl);
}

