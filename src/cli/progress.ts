import cliProgress from "cli-progress";

const BAR_DEFAULTS = {
	barCompleteChar: "█",
	barIncompleteChar: "░",
	hideCursor: true,
	clearOnComplete: false,
	barsize: 25,
} as const;

export function createBar(
	format: string,
	opts: Partial<cliProgress.Options> = {},
): cliProgress.SingleBar {
	return new cliProgress.SingleBar({ format, ...BAR_DEFAULTS, ...opts });
}
