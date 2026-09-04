import { App, ButtonComponent, Modal, Notice, TFile, TFolder } from "obsidian";

import { homeDirectory } from "./platform.ts";
import { parseShortcut, withUrl } from "./shortcut.ts";
import { resolveTarget } from "./target.ts";
import { addModalField } from "./ui.ts";
import { normalizeDestination } from "./url.ts";

/**
 * Editing an existing shortcut (decision D-005: editing is a deliberate
 * secondary action, reached from the File Explorer context menu).
 *
 * Both the name and the destination are editable. Obsidian's inline rename
 * is not available for a file type it will not otherwise open, so without a
 * name field here there would be no way to rename a shortcut from inside the
 * vault at all.
 *
 * Only the `URL=` line of the file is rewritten. Unknown and advanced fields
 * survive untouched, as required by the PRD.
 */
export class EditShortcutModal extends Modal {
	private readonly file: TFile;
	private raw = "";

	private name = "";
	private url = "";

	private collisionEl: HTMLElement | null = null;

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
			console.error("Elsewhere: could not read shortcut", error);
			new Notice("Could not read this shortcut.");
			this.close();
			return;
		}

		this.name = this.file.basename;
		this.url = parseShortcut(this.raw).url;

		this.titleEl.setText("Edit shortcut");

		const nameField = addModalField(contentEl, "Name", "Shortcut");
		nameField.input.value = this.name;
		nameField.input.addEventListener("input", () => {
			this.name = nameField.input.value;
			this.updateCollisionNotice();
		});

		const urlField = addModalField(
			contentEl,
			"URL",
			"https://example.com/ or /Users/you/file.pdf",
		);
		urlField.input.value = this.url;
		urlField.input.addEventListener("input", () => {
			this.url = urlField.input.value;
			urlField.setInvalid(
				this.url.trim().length > 0 &&
					!normalizeDestination(this.url, homeDirectory()),
			);
		});

		this.collisionEl = contentEl.createEl("p", {
			cls: "elsewhere-subtle elsewhere-collision",
		});
		this.collisionEl.hide();

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

		this.updateCollisionNotice();

		window.setTimeout(() => {
			urlField.input.focus();
			urlField.input.select();
		}, 0);
	}

	private folder(): TFolder {
		return this.file.parent ?? this.app.vault.getRoot();
	}

	private updateCollisionNotice(): void {
		if (!this.collisionEl) return;

		const target = resolveTarget(
			this.app,
			this.folder(),
			this.name,
			this.file.path,
		);

		if (!target || !target.suffixed) {
			this.collisionEl.hide();
			return;
		}

		this.collisionEl.setText(
			this.name.trim() +
				".url already exists here. This will be renamed to " +
				target.fileName +
				".",
		);
		this.collisionEl.show();
	}

	private async save(): Promise<void> {
		const destination = normalizeDestination(this.url, homeDirectory());

		if (!destination) {
			new Notice(
				"Enter a URL with a scheme, such as https://, or an absolute file path.",
			);
			return;
		}

		const target = resolveTarget(
			this.app,
			this.folder(),
			this.name,
			this.file.path,
		);

		if (!target) {
			new Notice("Enter a name for the shortcut.");
			return;
		}

		// Contents first: if the rename then fails, the destination change is
		// still saved rather than silently lost.
		const next = withUrl(this.raw, destination);
		if (next !== this.raw) {
			try {
				await this.app.vault.modify(this.file, next);
			} catch (error) {
				console.error("Elsewhere: could not save shortcut", error);
				new Notice("Could not save this shortcut.");
				return;
			}
		}

		if (target.path !== this.file.path) {
			try {
				await this.app.fileManager.renameFile(this.file, target.path);
			} catch (error) {
				console.error("Elsewhere: could not rename shortcut", error);
				new Notice("Saved the destination, but could not rename the file.");
				this.close();
				return;
			}
		}

		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
