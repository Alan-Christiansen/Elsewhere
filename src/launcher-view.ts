import { TFile, TextFileView, WorkspaceLeaf } from "obsidian";

import { openDestination } from "./launch.ts";
import { LauncherHistory } from "./launcher-history.ts";
import { parseShortcut } from "./shortcut.ts";

export const VIEW_TYPE_SHORTCUT = "elsewhere-shortcut-view";

/**
 * Registering the `.url` extension is what makes shortcuts visible in the
 * File Explorer, and registration requires a view. We do not actually want a
 * tab: decision D-005 says clicking a shortcut should open its destination,
 * exactly as it does in Finder and Explorer.
 *
 * So this view launches the destination and restores whatever that leaf held
 * before Obsidian navigated it to the shortcut. If Obsidian created a new leaf
 * specifically for the shortcut, the empty launcher leaf is detached instead.
 */
export class ShortcutLauncherView extends TextFileView {
	data = "";

	constructor(
		leaf: WorkspaceLeaf,
		private readonly launcherHistory: LauncherHistory,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_SHORTCUT;
	}

	getDisplayText(): string {
		return this.file ? this.file.basename : "Shortcut";
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

		// Let Obsidian finish its open sequence, then put back the previous view.
		// A genuinely new leaf has no previous view and can be safely detached.
		const leaf = this.leaf;
		window.setTimeout(() => {
			void this.launcherHistory.restoreOrDetach(leaf).catch((error) => {
				console.error("Elsewhere: could not restore the previous tab", error);
			});
		}, 0);
	}
}
