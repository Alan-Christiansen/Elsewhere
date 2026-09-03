import { App, Modal, Notice, Setting, TFile } from "obsidian";

import { parseShortcut, withUrl } from "./shortcut.ts";
import { isSupportedUrl } from "./url.ts";

/**
 * Editing an existing shortcut's destination (decision D-005: editing is a
 * deliberate secondary action, reached from the File Explorer context menu).
 *
 * Only the `URL=` line is rewritten. Unknown and advanced fields survive
 * untouched, as required by the PRD.
 */
export class EditUrlNoteModal extends Modal {
	private readonly file: TFile;
	private raw = "";
	private value = "";

	constructor(app: App, file: TFile) {
		super(app);
		this.file = file;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		try {
			this.raw = await this.app.vault.read(this.file);
		} catch (error) {
			console.error("URL Note: could not read shortcut", error);
			new Notice("Could not read this shortcut.");
			this.close();
			return;
		}

		this.value = parseShortcut(this.raw).url;

		contentEl.createEl("h2", { text: "Edit URL note" });
		contentEl.createEl("p", {
			text: this.file.name,
			cls: "url-note-subtle",
		});

		let urlInput: HTMLInputElement | null = null;

		new Setting(contentEl).setName("Destination").addText((text) => {
			urlInput = text.inputEl;
			text.setValue(this.value).onChange((next) => {
				this.value = next;
				this.updateValidity(urlInput);
			});
			text.inputEl.addClass("url-note-wide-input");
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => void this.save()),
			);

		this.scope.register([], "Enter", (event) => {
			event.preventDefault();
			void this.save();
			return false;
		});

		window.setTimeout(() => {
			urlInput?.focus();
			urlInput?.select();
		}, 0);
	}

	private updateValidity(input: HTMLInputElement | null): void {
		if (!input) return;
		const valid = this.value.trim().length === 0 || isSupportedUrl(this.value);
		input.toggleClass("url-note-invalid", !valid);
	}

	private async save(): Promise<void> {
		const next = this.value.trim();

		if (!isSupportedUrl(next)) {
			new Notice("That does not look like a valid URL.");
			return;
		}

		try {
			await this.app.vault.modify(this.file, withUrl(this.raw, next));
			this.close();
		} catch (error) {
			console.error("URL Note: could not save shortcut", error);
			new Notice("Could not save this shortcut.");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
