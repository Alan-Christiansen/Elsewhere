/**
 * Platform lookups, isolated here so the rest of the code stays pure and
 * testable. Each is guarded: the plugin is desktop-only, but a missing Node
 * module should degrade rather than throw during `onload`.
 */

export function homeDirectory(): string | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const os = require("os") as { homedir?: () => string };
		return os.homedir ? os.homedir() : null;
	} catch {
		return null;
	}
}
