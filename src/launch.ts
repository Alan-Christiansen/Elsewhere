import { Notice } from "obsidian";

/**
 * Opening a destination.
 *
 * Decision D-005: launch through Electron's `shell.openExternal` so the
 * destination opens in the user's default browser, or in the application
 * registered for a `file:` target. Handing the `.url` file itself to the OS
 * would instead reproduce the macOS Internet Location association, which
 * routes to Safari regardless of the user's default browser and may refuse
 * `file:` targets outright.
 */

interface ElectronShell {
	openExternal(url: string): Promise<void>;
}

function getShell(): ElectronShell | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const electron = require("electron") as { shell?: ElectronShell };
		return electron.shell ?? null;
	} catch {
		return null;
	}
}

export async function openDestination(url: string): Promise<void> {
	if (!url) {
		new Notice("This shortcut has no destination.");
		return;
	}

	const shell = getShell();
	if (!shell) {
		window.open(url);
		return;
	}

	try {
		await shell.openExternal(url);
	} catch (error) {
		console.error("Elsewhere: failed to open destination", error);
		new Notice("Could not open this destination.");
	}
}
