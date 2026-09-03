import { TFile, TextFileView, WorkspaceLeaf } from "obsidian";

import { openDestination } from "./launch.ts";
import { parseShortcut } from "./shortcut.ts";

export const VIEW_TYPE_SHORTCUT = "elsewhere-shortcut-view";

/**
 * Registering the `.url` extension is what makes shortcuts visible in the
 * File Explorer, and registration requires a view. We do not actually want a
 * tab: decision D-005 says clicking a shortcut should open its destination,
 * exactly as it does in Finder and Explorer.
 *
 * So this view launches the destination and immediately detaches its own
 * leaf, leaving no tab behind. Verified on macOS: only an explicit click or
 * the right-arrow key opens a file, so ordinary up/down navigation in the
 * File Explorer does not fire a launch.
 */
export class ShortcutLauncherView extends TextFileView {
	data = "";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_SHORTCUT;
	}

	getDisplayText(): string {
		return this.file ? this.file.basename : "URL note";
	}

	getIcon(): string {
		return "link";
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string): void {
		this.data = data;
	}

	clear(): void {
		this.data = "";
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);

		const { url } = parseShortcut(this.data);
		void openDestination(url);

		// Close the tab we were obliged to open. Deferred so that Obsidian
		// finishes its own open sequence before the leaf goes away.
		const leaf = this.leaf;
		window.setTimeout(() => {
			try {
				leaf.detach();
			} catch (error) {
				console.error("Elsewhere: could not close the launcher tab", error);
			}
		}, 0);
	}
}
