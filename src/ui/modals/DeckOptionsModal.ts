import { Modal, Setting, type App } from "obsidian";
import type { DeckLimits, FlashcardsSettings } from "../../settings/settings";

/** Per-deck daily limits that override the global ones. */
export class DeckOptionsModal extends Modal {
	constructor(
		app: App,
		private readonly settings: FlashcardsSettings,
		private readonly deckName: string,
		private readonly onSave: () => Promise<void>,
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl, settings, deckName } = this;
		this.titleEl.setText(`Options · ${deckName.split("::").pop() ?? deckName}`);
		const draft: Partial<DeckLimits> = { ...settings.deckLimits[deckName] };

		const numberSetting = (name: string, desc: string, key: keyof DeckLimits) =>
			new Setting(contentEl)
				.setName(name)
				.setDesc(`${desc} Leave empty to use the default (${settings.limits[key]}).`)
				.addText((text) => {
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.setPlaceholder(String(settings.limits[key]))
						.setValue(draft[key] === undefined ? "" : String(draft[key]))
						.onChange((value) => {
							const parsed = Number.parseInt(value, 10);
							if (value.trim() === "" || Number.isNaN(parsed)) delete draft[key];
							else draft[key] = Math.max(0, parsed);
						});
				});

		contentEl.createEl("p", { cls: "setting-item-description", text: "Limits apply to this deck and everything below it when you study it." });
		numberSetting("New cards per day", "How many new cards to introduce each day.", "newPerDay");
		numberSetting("Reviews per day", "The most review cards to show each day.", "reviewsPerDay");

		new Setting(contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						if (Object.keys(draft).length === 0) delete settings.deckLimits[deckName];
						else settings.deckLimits[deckName] = draft;
						await this.onSave();
						this.close();
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
