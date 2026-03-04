import * as readline from "node:readline/promises";
import ora from "ora";
import pc from "picocolors";
import { clearArl, loadArl, saveArl } from "../config.js";
import type { Deezer } from "../deezer/index.js";

/**
 * Prompt the user for an ARL token, attempt login with retry, and return the valid ARL.
 * Saves the ARL to .env on success. Calls process.exit(1) on failure.
 */
export async function loginWithPrompt(dz: Deezer): Promise<string> {
	let arl = loadArl();

	if (!arl) {
		console.log(
			pc.yellow("  ⚠ No ARL found. Please enter your Deezer ARL token."),
		);
		console.log(
			pc.dim("    (You can find this in your browser cookies at deezer.com)\n"),
		);

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		arl = await rl.question(pc.cyan("  Enter ARL: "));
		rl.close();

		if (!arl || arl.trim().length === 0) {
			console.error(pc.red("\n  ✗ No ARL provided. Exiting."));
			process.exit(1);
		}
		arl = arl.trim();
	}

	let loggedIn = false;
	let loginAttempts = 0;
	const maxLoginAttempts = 2;

	while (!loggedIn && loginAttempts < maxLoginAttempts) {
		const loginSpinner = ora({
			text: "Logging in to Deezer...",
			prefixText: " ",
			color: "magenta",
		}).start();

		loggedIn = await dz.loginViaArl(arl);

		if (!loggedIn) {
			loginSpinner.fail(
				pc.red("Login failed. Your ARL token may be expired or invalid."),
			);
			clearArl();

			console.log();
			console.log(pc.yellow("  ⚠ Please enter a new Deezer ARL token."));
			console.log(
				pc.dim(
					"    (You can find this in your browser cookies at deezer.com)\n",
				),
			);

			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			arl = await rl.question(pc.cyan("  Enter ARL: "));
			rl.close();

			if (!arl || arl.trim().length === 0) {
				console.error(pc.red("\n  ✗ No ARL provided. Exiting."));
				process.exit(1);
			}
			arl = arl.trim();
			loginAttempts++;
		} else {
			loginSpinner.succeed(
				pc.green(`Logged in as ${pc.bold(dz.currentUser?.name || "Unknown")}`),
			);
			saveArl(arl);
		}
	}

	if (!loggedIn) {
		console.error(
			pc.red("\n  ✗ Failed to login after multiple attempts. Exiting."),
		);
		process.exit(1);
	}

	return arl;
}
