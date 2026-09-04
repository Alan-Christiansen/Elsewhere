import {
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

import { CreateShortcutModal } from "./create-modal.ts";
import { EditShortcutModal } from "./edit-modal.ts";
import { EXTENSION } from "./filename.ts";
import { openDestination } from "./launch.ts";
import { LauncherHistory } from "./launcher-history.ts";
import { ShortcutLauncherView, VIEW_TYPE_SHORTCUT } from "./launcher-view.ts";
import { parseShortcut } from "./shortcut.ts";

const FILE_EXPLORER_ITEM = ".nav-file-title[data-path]";
const FILE_EXPLORER = ".nav-files-container";

export default class ElsewherePlugin extends Plugin {
	private readonly launcherHistory = new LauncherHistory(VIEW_TYPE_SHORTCUT);

	async onload(): Promise<void> {
		this.registerView(
			VIEW_TYPE_SHORTCUT,
			(leaf) => new ShortcutLauncherView(leaf, this.launcherHistory),
		);

		this.app.workspace.onLayoutReady(() => this.rememberOpenViews());
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf) this.launcherHistory.remember(leaf);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				const leaf = this.app.workspace.getMostRecentLeaf();
				if (leaf) this.launcherHistory.remember(leaf);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.rememberOpenViews()),
		);

		// Makes .url files visible in the File Explorer without requiring the
		// user to enable Obsidian's "Detect all file extensions" setting. The
		// on-disk file is untouched and stays a standard Internet Shortcut.
		try {
			this.registerExtensions([EXTENSION], VIEW_TYPE_SHORTCUT);
		} catch (error) {
			console.error("Elsewhere: could not register the .url extension", error);
			new Notice(
				"Elsewhere: another plugin has already claimed .url files. " +
					"Disable it to use Elsewhere.",
				10000,
			);
		}

		// Extension registration makes .url files visible, but Obsidian normally
		// opens a registered extension in the active leaf. Handle File Explorer
		// activation before that navigation begins so no tab ever changes.
		this.registerDomEvent(
			document,
			"click",
			(event) => this.handleExplorerClick(event),
			{ capture: true },
		);
		this.registerDomEvent(
			document,
			"keydown",
			(event) => this.handleExplorerKeydown(event),
			{ capture: true },
		);

		this.addCommand({
			id: "new-shortcut",
			name: "New shortcut...",
			callback: () => void this.openCreateModal(this.defaultFolder()),
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, target) => {
				if (target instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle("New shortcut...")
							.setIcon("link")
							.onClick(() => void this.openCreateModal(target)),
					);
					return;
				}

				if (!(target instanceof TFile)) return;

				menu.addItem((item) =>
					item
						.setTitle("New shortcut...")
						.setIcon("link")
						.onClick(() =>
							void this.openCreateModal(this.parentOf(target)),
						),
				);

				if (target.extension === EXTENSION) {
					menu.addItem((item) =>
						item
							.setTitle("Edit shortcut...")
							.setIcon("pencil")
							.onClick(() => new EditShortcutModal(this.app, target).open()),
					);
				}
			}),
		);
	}

	/**
	 * Destination for a command-palette invocation: the active file's parent,
	 * falling back to the vault root.
	 */
	private defaultFolder(): TFolder {
		const active = this.app.workspace.getActiveFile();
		if (active) return this.parentOf(active);
		return this.app.vault.getRoot();
	}

	private parentOf(file: TAbstractFile): TFolder {
		return file.parent ?? this.app.vault.getRoot();
	}

	private async openCreateModal(folder: TFolder): Promise<void> {
		let clipboard = "";
		try {
			clipboard = await navigator.clipboard.readText();
		} catch {
			// Clipboard access can be refused; the modal handles an empty value
			// by focusing the URL field instead.
			clipboard = "";
		}

		new CreateShortcutModal(this.app, folder, clipboard).open();
	}

	private handleExplorerClick(event: MouseEvent): void {
		if (event.button !== 0) return;
		const file = this.shortcutFromExplorerTarget(event.target, false);
		if (!file) return;

		this.consumeActivation(event);
		void this.launchShortcut(file);
	}

	private handleExplorerKeydown(event: KeyboardEvent): void {
		if (event.key !== "Enter" && event.key !== "ArrowRight") return;

		const target = event.target as Element | null;
		if (target?.closest("input, textarea, [contenteditable='true']")) return;

		const file = this.shortcutFromExplorerTarget(event.target, true);
		if (!file) return;

		this.consumeActivation(event);
		if (!event.repeat) void this.launchShortcut(file);
	}

	private shortcutFromExplorerTarget(
		target: EventTarget | null,
		useSelectedItem: boolean,
	): TFile | null {
		const element = target as Element | null;
		if (!element || typeof element.closest !== "function") return null;

		let item = element.closest(FILE_EXPLORER_ITEM);
		if (!item && useSelectedItem) {
			const explorer = element.closest(FILE_EXPLORER);
			item = explorer?.querySelector(`${FILE_EXPLORER_ITEM}.is-active`) ?? null;
		}

		const path = item?.getAttribute("data-path");
		if (!path) return null;

		const candidate = this.app.vault.getAbstractFileByPath(path);
		return candidate instanceof TFile && candidate.extension === EXTENSION
			? candidate
			: null;
	}

	private consumeActivation(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	}

	private async launchShortcut(file: TFile): Promise<void> {
		try {
			const data = await this.app.vault.cachedRead(file);
			const { url } = parseShortcut(data);
			await openDestination(url);
		} catch (error) {
			console.error("Elsewhere: could not read shortcut", error);
			new Notice("Could not open this shortcut.");
		}
	}

	private rememberOpenViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			this.launcherHistory.remember(leaf);
		});
	}
}
