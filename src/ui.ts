/**
 * Form fields for modals.
 *
 * Obsidian styles bare text inputs globally, so a plain labelled input looks
 * native without any help from us. The `Setting` component is deliberately
 * not used here: it belongs to the settings tab, where rows are separated by
 * rules, and those rules read as stray lines inside a compact dialog.
 * Stacking the label above a full-width input also suits a short form better
 * than the settings tab's label-left, control-right layout.
 */
export interface ModalField {
	input: HTMLInputElement;
	setInvalid(invalid: boolean): void;
}

export function addModalField(
	parent: HTMLElement,
	label: string,
	placeholder: string,
): ModalField {
	const wrapper = parent.createDiv({ cls: "elsewhere-field" });
	wrapper.createEl("label", { text: label, cls: "elsewhere-field-label" });

	const input = wrapper.createEl("input", {
		type: "text",
		cls: "elsewhere-field-input",
	});
	input.placeholder = placeholder;

	return {
		input,
		setInvalid(invalid: boolean) {
			input.toggleClass("elsewhere-invalid", invalid);
		},
	};
}
