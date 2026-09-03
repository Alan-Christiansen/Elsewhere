import { App, ButtonComponent, Modal, Notice, TFile } from "obsidian";

import { parseShortcut, withUrl } from "./shortcut.ts";
import { addModalField } from "./ui.ts";
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

		this.titleEl.setText("Edit URL note");

		const destination = addModalField(
			contentEl,
			"Destination",
			"https://example.com/",
		);
		destination.input.value = this.value;
		destination.input.addEventListener("input", () => {
			this.value = destination.input.value;
			destination.setInvalid(
				this.value.trim().length > 0 && !isSupportedUrl(this.value),
			);
		});

		contentEl.createEl("p", {
			text: this.file.name,
			cls: "url-note-subtle url-note-destination",
		});

		const buttons = contentEl.createDiv({ cls: "modal-button-container" });

		new ButtonComponent(buttons)
			.setButtonText("Save")
			.setCta()
			.onClick(() => void this.save());

		new ButtonComponent(buttons)
			.setButtonText("Cancel")
			.onClick(() => this.close());

		this.scope.register([], "Enter", (event) => {
			event.preventDefault();
			void this.save();
			return false;
		});

		window.setTimeout(() => {
			destination.input.focus();
			destination.input.select();
		}, 0);
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
