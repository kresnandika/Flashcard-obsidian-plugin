import { FuzzySuggestModal, type App } from "obsidian";

/** Quick deck picker for the "Study deck…" command. */
export class DeckSuggestModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private readonly decks: string[],
		private readonly onChoose: (deckName: string) => void,
	) {
		super(app);
		this.setPlaceholder("Study which deck?");
	}

	getItems(): string[] {
		return this.decks;
	}

	getItemText(deckName: string): string {
		return deckName.split("::").join(" › ");
	}

	onChooseItem(deckName: string): void {
		this.onChoose(deckName);
	}
}
