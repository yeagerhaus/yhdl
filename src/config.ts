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
 * Get the .env file path in the project root
 */
function getEnvPath(): string {
	// Find project root by looking for package.json
	let currentDir = process.cwd();
	const root = path.parse(currentDir).root;

	while (currentDir !== root) {
		const packageJsonPath = path.join(currentDir, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			return path.join(currentDir, ".env");
		}
		currentDir = path.dirname(currentDir);
	}

	// Fallback to current directory if package.json not found
	return path.join(process.cwd(), ".env");
}

/**
 * Load config from .env file
 * Bun automatically loads .env files, so we can read from process.env
 */
export function loadConfig(): Config {
	const musicRootPath = process.env.MUSIC_ROOT_PATH?.trim();

	return {
		musicRootPath: musicRootPath || DEFAULT_CONFIG.musicRootPath,
	};
}

/**
 * Load ARL from .env file
 */
export function loadArl(): string | null {
	const arl = process.env.DEEZER_ARL?.trim();
	return arl && arl.length > 0 ? arl : null;
}

/**
 * Save ARL to .env file
 * Updates the .env file, creating it if it doesn't exist
 */
export function saveArl(arl: string): void {
	const envPath = getEnvPath();
	let envContent = "";

	// Read existing .env file if it exists
	if (fs.existsSync(envPath)) {
		envContent = fs.readFileSync(envPath, "utf-8");
	}

	// Update or add DEEZER_ARL
	const lines = envContent.split("\n");
	let arlFound = false;
	const updatedLines = lines.map((line) => {
		if (line.trim().startsWith("DEEZER_ARL=")) {
			arlFound = true;
			return `DEEZER_ARL=${arl}`;
		}
		return line;
	});

	// If ARL wasn't found, add it
	if (!arlFound) {
		// Add a newline if file doesn't end with one
		if (envContent && !envContent.endsWith("\n")) {
			updatedLines.push("");
		}
		updatedLines.push(`DEEZER_ARL=${arl}`);
	}

	// Write back to .env file
	fs.writeFileSync(envPath, updatedLines.join("\n"), "utf-8");
}

/**
 * Clear ARL from .env file (useful when token is expired/invalid)
 */
export function clearArl(): void {
	const envPath = getEnvPath();
	
	if (!fs.existsSync(envPath)) {
		return;
	}

	const envContent = fs.readFileSync(envPath, "utf-8");
	const lines = envContent.split("\n");
	const updatedLines = lines.filter((line) => !line.trim().startsWith("DEEZER_ARL="));

	// Write back to .env file
	fs.writeFileSync(envPath, updatedLines.join("\n"), "utf-8");
}

/**
 * Get the .env file path (for display purposes)
 */
export function getEnvPathForDisplay(): string {
	return getEnvPath();
}
