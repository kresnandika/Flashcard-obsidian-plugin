import { Modal, Setting, type App } from "obsidian";
import type { CardRef } from "../../domain/types";
import { detectRoles, FIELD_ROLES, ROLE_LABELS, type FieldRole } from "../../rendering/layout/fieldRoles";
import type { FlashcardsSettings } from "../../settings/settings";

/** Lets the user correct which note field fills each part of the Flashcards layout, per note type. */
export class FieldRolesModal extends Modal {
	constructor(
		app: App,
		private readonly settings: FlashcardsSettings,
		private readonly ref: CardRef,
		private readonly onSave: () => Promise<void>,
	) {
		super(app);
	}

	override onOpen(): void {
		this.modalEl.addClass("fc-modal");
		const { contentEl, ref, settings } = this;
		this.titleEl.setText(`Card fields · ${ref.noteType.name}`);
		contentEl.createEl("p", {
			cls: "setting-item-description",
			text: "Which field fills each part of the Flashcards layout. Detected automatically; change any that look wrong. Applies to every card of this note type.",
		});

		const detected = detectRoles(ref.noteType, ref.note.fields);
		const draft: Partial<Record<FieldRole, number | null>> = { ...settings.noteTypeLayouts[ref.noteType.id]?.roles };

		for (const role of FIELD_ROLES) {
			const current = role in draft ? draft[role] : detected[role];
			new Setting(contentEl).setName(ROLE_LABELS[role]).addDropdown((dropdown) => {
				dropdown.addOption("", "Not shown");
				ref.noteType.fields.forEach((name, index) => dropdown.addOption(String(index), name));
				dropdown.setValue(current === undefined || current === null ? "" : String(current));
				dropdown.onChange((value) => {
					const chosen = value === "" ? null : Number(value);
					if (chosen === (detected[role] ?? null)) delete draft[role];
					else draft[role] = chosen;
				});
			});
		}

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("Reset to detected").onClick(async () => {
					this.store({});
					await this.onSave();
					this.close();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						this.store(draft);
						await this.onSave();
						this.close();
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private store(roles: Partial<Record<FieldRole, number | null>>): void {
		const layouts = this.settings.noteTypeLayouts;
		const id = this.ref.noteType.id;
		const next = { ...layouts[id], roles: Object.keys(roles).length > 0 ? roles : undefined };
		if (!next.roles) delete next.roles;
		if (Object.keys(next).length === 0) delete layouts[id];
		else layouts[id] = next;
	}
}
