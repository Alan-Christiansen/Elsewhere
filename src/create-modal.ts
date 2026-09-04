import { App, ButtonComponent, Modal, Notice, TFolder } from "obsidian";

import { EXTENSION, suggestBaseName } from "./filename.ts";
import { createShortcut } from "./shortcut.ts";
import { resolveTarget } from "./target.ts";
import { addModalField } from "./ui.ts";
import { homeDirectory } from "./platform.ts";
import { normalizeDestination } from "./url.ts";

/**
 * The confirmation-first creation flow (decisions D-002 and D-003).
 *
 * A valid clipboard destination prefills the URL and produces a suggested
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
	private collisionEl: HTMLElement | null = null;

	constructor(app: App, folder: TFolder, clipboardUrl: string) {
		super(app);
		this.folder = folder;
		this.clipboardUrl = clipboardUrl;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.titleEl.setText("New shortcut");

		const clipboardDestination = normalizeDestination(this.clipboardUrl, homeDirectory());
		if (clipboardDestination) {
			this.url = this.clipboardUrl.trim();
			this.name = suggestBaseName(clipboardDestination);
		}

		const nameField = addModalField(contentEl, "Name", "Shortcut");
		this.nameInput = nameField.input;
		nameField.input.value = this.name;
		nameField.input.addEventListener("input", () => {
			this.name = nameField.input.value;
			this.nameIsSuggested = false;
			this.updateCollisionNotice();
		});

		const urlField = addModalField(
			contentEl,
			"URL",
			"https://example.com/ or /Users/you/file.pdf",
		);
		this.urlInput = urlField.input;
		urlField.input.value = this.url;
		urlField.input.addEventListener("input", () => {
			this.url = urlField.input.value;
			const destination = normalizeDestination(this.url, homeDirectory());
			if (this.nameIsSuggested && destination) {
				this.name = suggestBaseName(destination);
				nameField.input.value = this.name;
			}
			urlField.setInvalid(this.url.trim().length > 0 && !destination);
			this.updateCollisionNotice();
		});

		contentEl.createEl("p", {
			text:
				"Saving to " +
				(this.folder.path === "/" ? "vault root" : this.folder.path),
			cls: "elsewhere-subtle elsewhere-destination",
		});

		this.collisionEl = contentEl.createEl("p", {
			cls: "elsewhere-subtle elsewhere-collision",
		});
		this.collisionEl.hide();

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

		this.updateCollisionNotice();

		window.setTimeout(() => {
			if (clipboardDestination && this.nameInput) {
				this.nameInput.focus();
				this.nameInput.select();
			} else {
				this.urlInput?.focus();
			}
		}, 0);
	}

	/**
	 * Says so in advance when the name is taken, rather than letting the user
	 * discover the numeric suffix afterwards in the file explorer. Never
	 * blocks, and never overwrites.
	 */
	private updateCollisionNotice(): void {
		if (!this.collisionEl) return;

		const target = resolveTarget(this.app, this.folder, this.name);

		if (!target || !target.suffixed) {
			this.collisionEl.hide();
			return;
		}

		this.collisionEl.setText(
			this.name.trim() +
				"." +
				EXTENSION +
				" already exists here. This will be created as " +
				target.fileName +
				".",
		);
		this.collisionEl.show();
	}

	private async create(): Promise<void> {
		const destination = normalizeDestination(this.url, homeDirectory());

		if (!destination) {
			new Notice(
				"Enter a URL with a scheme, such as https://, or an absolute file path.",
			);
			this.urlInput?.focus();
			return;
		}

		const base = this.name.trim() || suggestBaseName(destination);
		const target = resolveTarget(this.app, this.folder, base);

		if (!target) {
			new Notice("Enter a name for the shortcut.");
			return;
		}

		try {
			const file = await this.app.vault.create(
				target.path,
				createShortcut(destination),
			);
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
