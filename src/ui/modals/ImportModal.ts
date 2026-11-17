import { Modal, Notice, type App } from "obsidian";
import type { ImportProgress, ImportReport } from "../../storage/PackageRepository";
import { errorMessage } from "../../utils/errors";
import { pluralize } from "../../utils/strings";

/**
 * Picks an `.apkg` / `.colpkg` file and imports it. Uses a plain file input,
 * which works on desktop and mobile alike.
 */
export class ImportModal extends Modal {
	private busy = false;

	constructor(
		app: App,
		private readonly importFile: (data: ArrayBuffer, fileName: string, onProgress: (progress: ImportProgress) => void) => Promise<ImportReport>,
	) {
		super(app);
	}

	override onOpen(): void {
		this.modalEl.addClass("fc-modal");
		this.titleEl.setText("Import Anki deck");
		const { contentEl } = this;
		contentEl.addClass("fc-import");
		contentEl.createEl("p", {
			text: "Choose an Anki deck package (.apkg) or collection package (.colpkg). Templates, styling, audio and images come with it. Importing a deck again updates its cards and keeps your progress.",
		});

		const input = contentEl.createEl("input", { attr: { type: "file", accept: ".apkg,.colpkg" } });
		const status = contentEl.createDiv({ cls: "fc-import-status" });
		const bar = contentEl.createEl("progress", { cls: "fc-import-progress", attr: { max: "100", value: "0" } });
		bar.hide();

		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (file) void this.run(file, status, bar, input);
		});
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private async run(file: File, status: HTMLElement, bar: HTMLProgressElement, input: HTMLInputElement): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		input.disabled = true;
		bar.show();
		const step = (text: string, percent: number) => {
			status.setText(text);
			bar.value = percent;
		};

		try {
			step(`Reading ${file.name}…`, 5);
			const report = await this.importFile(await file.arrayBuffer(), file.name, (progress) => {
				if (progress.stage === "reading") step(`Reading ${file.name}…`, 10);
				else if (progress.stage === "media") step(`Copying media ${progress.done}/${progress.total}…`, 15 + Math.round((progress.done / Math.max(1, progress.total)) * 80));
				else step("Saving…", 97);
			});

			step("", 100);
			const summary = report.updatedExisting
				? `Updated "${report.packageName}": ${pluralize(report.notesAdded, "new note")}, ${pluralize(report.notesUpdated, "changed note")}, ${pluralize(report.cardsAdded, "new card")}.`
				: `Imported "${report.packageName}": ${pluralize(report.cardsAdded, "card")} from ${pluralize(report.notesAdded, "note")}, ${pluralize(report.mediaWritten, "media file")}.`;
			new Notice(summary);
			this.close();
		} catch (error) {
			console.error("Flashcards: import failed", error);
			status.setText(`Import failed: ${errorMessage(error)}`);
			status.addClass("mod-warning");
			bar.hide();
			input.disabled = false;
		} finally {
			this.busy = false;
		}
	}
}
