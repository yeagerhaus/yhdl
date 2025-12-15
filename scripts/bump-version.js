#!/usr/bin/env node

/**
 * Auto-bump version based on commit count since last tag
 * Usage: node scripts/bump-version.js [patch|minor|major|auto]
 * 
 * If "auto" (default), it will:
 * - Count commits since last tag
 * - Use patch for < 10 commits
 * - Use minor for 10-99 commits  
 * - Use major for 100+ commits
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, "..", "package.json");

function getCurrentVersion() {
	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	return pkg.version;
}

function bumpVersion(version, type) {
	const [major, minor, patch] = version.split(".").map(Number);

	switch (type) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
		default:
			throw new Error(`Unknown version type: ${type}`);
	}
}

function getCommitCount() {
	try {
		// Get the last tag
		const lastTag = execSync("git describe --tags --abbrev=0 2>/dev/null || echo", {
			encoding: "utf-8",
		}).trim();

		if (!lastTag) {
			// No tags exist, count all commits
			const count = execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim();
			return parseInt(count, 10);
		}

		// Count commits since last tag
		const count = execSync(`git rev-list --count ${lastTag}..HEAD`, {
			encoding: "utf-8",
		}).trim();
		return parseInt(count, 10) || 0;
	} catch (error) {
		console.warn("Could not determine commit count, using patch bump");
		return 0;
	}
}

function determineBumpType(commitCount) {
	if (commitCount >= 100) {
		return "major";
	} else if (commitCount >= 10) {
		return "minor";
	} else {
		return "patch";
	}
}

function updatePackageJson(newVersion) {
	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	const oldVersion = pkg.version;
	pkg.version = newVersion;
	fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, "\t") + "\n");
	return { oldVersion, newVersion };
}

function main() {
	const bumpType = process.argv[2] || "auto";
	const currentVersion = getCurrentVersion();

	let type;
	if (bumpType === "auto") {
		const commitCount = getCommitCount();
		type = determineBumpType(commitCount);
		console.log(`📊 Commit count since last tag: ${commitCount}`);
		console.log(`🔀 Auto-detected bump type: ${type}`);
	} else {
		type = bumpType;
	}

	if (!["major", "minor", "patch"].includes(type)) {
		console.error(`❌ Invalid bump type: ${type}`);
		console.error("Usage: node scripts/bump-version.js [patch|minor|major|auto]");
		process.exit(1);
	}

	const newVersion = bumpVersion(currentVersion, type);
	const { oldVersion } = updatePackageJson(newVersion);

	console.log(`✅ Version bumped: ${oldVersion} → ${newVersion}`);
	console.log(`\n📝 Next steps:`);
	console.log(`   1. Review the changes in package.json`);
	console.log(`   2. Commit: git add package.json && git commit -m "chore: bump version to ${newVersion}"`);
	console.log(`   3. Tag: git tag v${newVersion}`);
	console.log(`   4. Push: git push origin main --tags`);
}

main();
