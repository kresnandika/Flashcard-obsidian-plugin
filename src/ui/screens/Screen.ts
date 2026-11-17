import type { ForwardedKey } from "../components/CardFrame";

/** One page of the flashcards view (deck list, review, browser). */
export interface Screen {
	/** Builds the screen inside `container`, which is emptied beforehand. */
	render(container: HTMLElement): void;
	/** Returns true when the key was handled. */
	handleKey?(key: ForwardedKey): boolean;
	/** Called when data changed elsewhere (sync, another view). */
	onDataChanged?(): void;
	destroy?(): void;
}

/** Callbacks a screen uses to move to another screen. */
export interface Navigator {
	home(): void;
	review(deckName: string | null): void;
	browse(deckName: string | null): void;
}
