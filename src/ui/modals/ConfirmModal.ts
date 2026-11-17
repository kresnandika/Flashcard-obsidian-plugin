import { Modal, Setting, type App } from "obsidian";

/** Asks a yes/no question; resolves true when confirmed. */
export function confirm(app: App, title: string, message: string, confirmLabel = "Delete"): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const modal = new (class extends Modal {
			override onOpen(): void {
				this.titleEl.setText(title);
				this.contentEl.createEl("p", { text: message });
				new Setting(this.contentEl)
					.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
					.addButton((button) =>
						button
							.setButtonText(confirmLabel)
							.setWarning()
							.onClick(() => {
								settled = true;
								resolve(true);
								this.close();
							}),
					);
			}
			override onClose(): void {
				if (!settled) resolve(false);
				this.contentEl.empty();
			}
		})(app);
		modal.open();
	});
}
