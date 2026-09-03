import { App, Modal, Notice, Setting, TFolder, normalizePath } from "obsidian";

import { EXTENSION, resolveCollision, suggestBaseName } from "./filename.ts";
import { createShortcut } from "./shortcut.ts";
import { isSupportedUrl } from "./url.ts";

/**
 * The confirmation-first creation flow (decisions D-002 and D-003).
 *
 * A valid clipboard URL prefills the destination and produces a suggested
 * name, which is fully selected so typing replaces it. Without one, the URL
 * field takes focus and the name is suggested once a valid URL is entered.
 */
export class CreateUrlNoteModal extends Modal {
	private readonly folder: TFolder;
	private readonly clipboardUrl: string;

	private url = "";
	private name = "";
	/** True while the name is ours to overwrite; false once the user types. */
	private nameIsSuggested = true;

	private nameInput: HTMLInputElement | null = null;
	private urlInput: HTMLInputElement | null = null;

	constructor(app: App, folder: TFolder, clipboardUrl: string) {
		super(app);
		this.folder = folder;
		this.clipboardUrl = clipboardUrl;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "New URL note" });

		const hasClipboardUrl = isSupportedUrl(this.clipboardUrl);
		if (hasClipboardUrl) {
			this.url = this.clipboardUrl.trim();
			this.name = suggestBaseName(this.url);
		}

		new Setting(contentEl).setName("Name").addText((text) => {
			this.nameInput = text.inputEl;
			text
				.setPlaceholder("URL Note")
				.setValue(this.name)
				.onChange((next) => {
					this.name = next;
					this.nameIsSuggested = false;
				});
			text.inputEl.addClass("url-note-wide-input");
		});

		new Setting(contentEl).setName("URL").addText((text) => {
			this.urlInput = text.inputEl;
			text
				.setPlaceholder("https://example.com/")
				.setValue(this.url)
				.onChange((next) => {
					this.url = next;
					if (this.nameIsSuggested && isSupportedUrl(next)) {
						this.name = suggestBaseName(next);
						if (this.nameInput) this.nameInput.value = this.name;
					}
					this.urlInput?.toggleClass(
						"url-note-invalid",
						next.trim().length > 0 && !isSupportedUrl(next),
					);
				});
			text.inputEl.addClass("url-note-wide-input");
		});

		contentEl.createEl("p", {
			text: "Saving to " + (this.folder.path === "/" ? "vault root" : this.folder.path),
			cls: "url-note-subtle",
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText("Create")
					.setCta()
					.onClick(() => void this.create()),
			);

		this.scope.register([], "Enter", (event) => {
			event.preventDefault();
			void this.create();
			return false;
		});

		window.setTimeout(() => {
			if (hasClipboardUrl && this.nameInput) {
				this.nameInput.focus();
				this.nameInput.select();
			} else {
				this.urlInput?.focus();
			}
		}, 0);
	}

	private async create(): Promise<void> {
		const url = this.url.trim();

		if (!isSupportedUrl(url)) {
			new Notice("Enter a valid URL, including https:// or another scheme.");
			this.urlInput?.focus();
			return;
		}

		const base = this.name.trim() || suggestBaseName(url);
		const folderPath = this.folder.path === "/" ? "" : this.folder.path + "/";

		const fileName = resolveCollision(base, (candidate) => {
			const path = normalizePath(folderPath + candidate);
			return this.app.vault.getAbstractFileByPath(path) !== null;
		});

		const path = normalizePath(folderPath + fileName);

		try {
			const file = await this.app.vault.create(path, createShortcut(url));
			new Notice("Created " + file.name);
			this.close();
		} catch (error) {
			console.error("URL Note: could not create shortcut", error);
			new Notice("Could not create the shortcut. Check the name for invalid characters.");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export { EXTENSION };
