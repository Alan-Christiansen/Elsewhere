import { App, ButtonComponent, Modal, Notice, TFolder, normalizePath } from "obsidian";

import { EXTENSION, resolveCollision, suggestBaseName } from "./filename.ts";
import { createShortcut } from "./shortcut.ts";
import { addModalField } from "./ui.ts";
import { isSupportedUrl } from "./url.ts";

/**
 * The confirmation-first creation flow (decisions D-002 and D-003).
 *
 * A valid clipboard URL prefills the destination and produces a suggested
 * name, which is fully selected so typing replaces it. Without one, the URL
 * field takes focus and the name is suggested once a valid URL is entered.
 */
export class CreateShortcutModal extends Modal {
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

		this.titleEl.setText("New shortcut");

		const hasClipboardUrl = isSupportedUrl(this.clipboardUrl);
		if (hasClipboardUrl) {
			this.url = this.clipboardUrl.trim();
			this.name = suggestBaseName(this.url);
		}

		const nameField = addModalField(contentEl, "Name", "Shortcut");
		this.nameInput = nameField.input;
		nameField.input.value = this.name;
		nameField.input.addEventListener("input", () => {
			this.name = nameField.input.value;
			this.nameIsSuggested = false;
		});

		const urlField = addModalField(contentEl, "URL", "https://example.com/");
		this.urlInput = urlField.input;
		urlField.input.value = this.url;
		urlField.input.addEventListener("input", () => {
			this.url = urlField.input.value;
			if (this.nameIsSuggested && isSupportedUrl(this.url)) {
				this.name = suggestBaseName(this.url);
				nameField.input.value = this.name;
			}
			urlField.setInvalid(
				this.url.trim().length > 0 && !isSupportedUrl(this.url),
			);
		});

		contentEl.createEl("p", {
			text:
				"Saving to " +
				(this.folder.path === "/" ? "vault root" : this.folder.path),
			cls: "elsewhere-subtle elsewhere-destination",
		});

		const buttons = contentEl.createDiv({ cls: "modal-button-container" });

		new ButtonComponent(buttons)
			.setButtonText("Create")
			.setCta()
			.onClick(() => void this.create());

		new ButtonComponent(buttons)
			.setButtonText("Cancel")
			.onClick(() => this.close());

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
			console.error("Elsewhere: could not create shortcut", error);
			new Notice(
				"Could not create the shortcut. Check the name for invalid characters.",
			);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export { EXTENSION };
