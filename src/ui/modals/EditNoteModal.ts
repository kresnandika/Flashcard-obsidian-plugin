import { Modal, Setting, type App } from "obsidian";
import type { CardRef } from "../../domain/types";

/** Edits the raw (HTML) fields and tags of a card's note. */
export class EditNoteModal extends Modal {
	constructor(
		app: App,
		private readonly ref: CardRef,
		private readonly onSave: () => Promise<void>,
	) {
		super(app);
	}

	override onOpen(): void {
		this.modalEl.addClass("fc-modal");
		const { contentEl, ref } = this;
		this.titleEl.setText(`Edit note · ${ref.noteType.name}`);
		contentEl.addClass("fc-edit-note");
		const values = [...ref.note.fields];
		let tags = ref.note.tags.join(" ");

		ref.noteType.fields.forEach((name, index) => {
			new Setting(contentEl).setName(name).addTextArea((area) => {
				area.setValue(values[index] ?? "").onChange((value) => (values[index] = value));
				area.inputEl.rows = Math.min(6, Math.max(1, Math.ceil((values[index] ?? "").length / 60)));
			});
		});
		new Setting(contentEl)
			.setName("Tags")
			.setDesc("Separated by spaces.")
			.addText((text) => text.setValue(tags).onChange((value) => (tags = value)));

		new Setting(contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						ref.note.fields = values;
						ref.note.tags = tags.split(/\s+/).filter(Boolean);
						ref.note.modified = Math.floor(Date.now() / 1000);
						await this.onSave();
						this.close();
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
