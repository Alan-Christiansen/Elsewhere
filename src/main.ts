import {
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

import { CreateUrlNoteModal } from "./create-modal.ts";
import { EditUrlNoteModal } from "./edit-modal.ts";
import { EXTENSION } from "./filename.ts";
import { UrlNoteLauncherView, VIEW_TYPE_URL_NOTE } from "./launcher-view.ts";

export default class UrlNotePlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(
			VIEW_TYPE_URL_NOTE,
			(leaf) => new UrlNoteLauncherView(leaf),
		);

		// Makes .url files visible in the File Explorer without requiring the
		// user to enable Obsidian's "Detect all file extensions" setting. The
		// on-disk file is untouched and stays a standard Internet Shortcut.
		try {
			this.registerExtensions([EXTENSION], VIEW_TYPE_URL_NOTE);
		} catch (error) {
			console.error("URL Note: could not register the .url extension", error);
			new Notice(
				"URL Note: another plugin has already claimed .url files. " +
					"Disable it to use URL Note.",
				10000,
			);
		}

		this.addCommand({
			id: "create-url-note",
			name: "New URL note",
			callback: () => void this.openCreateModal(this.defaultFolder()),
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, target) => {
				if (target instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle("New URL note")
							.setIcon("link")
							.onClick(() => void this.openCreateModal(target)),
					);
					return;
				}

				if (!(target instanceof TFile)) return;

				menu.addItem((item) =>
					item
						.setTitle("New URL note")
						.setIcon("link")
						.onClick(() =>
							void this.openCreateModal(this.parentOf(target)),
						),
				);

				if (target.extension === EXTENSION) {
					menu.addItem((item) =>
						item
							.setTitle("Edit URL note...")
							.setIcon("pencil")
							.onClick(() => new EditUrlNoteModal(this.app, target).open()),
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

		new CreateUrlNoteModal(this.app, folder, clipboard).open();
	}
}
