import { isInDeck } from "./deckTree";
import type { CardProgress, CardRef, LoadedPackage } from "./types";

/**
 * In-memory index over every loaded package. It knows nothing about files:
 * persistence lives in storage/PackageRepository, which owns an instance.
 */
export class Collection {
	private readonly packages = new Map<string, LoadedPackage>();
	private refs: CardRef[] | null = null;
	private refsByKey: Map<string, CardRef> | null = null;

	static cardKey(packageId: string, cardId: string): string {
		return `${packageId}/${cardId}`;
	}

	setPackage(pkg: LoadedPackage): void {
		this.packages.set(pkg.data.id, pkg);
		this.invalidate();
	}

	removePackage(packageId: string): void {
		this.packages.delete(packageId);
		this.invalidate();
	}

	getPackage(packageId: string): LoadedPackage | undefined {
		return this.packages.get(packageId);
	}

	allPackages(): LoadedPackage[] {
		return [...this.packages.values()];
	}

	/** Call after notes, cards or decks change. Progress changes don't need it. */
	invalidate(): void {
		this.refs = null;
		this.refsByKey = null;
	}

	cards(): readonly CardRef[] {
		if (!this.refs) this.index();
		return this.refs as CardRef[];
	}

	card(key: string): CardRef | undefined {
		if (!this.refsByKey) this.index();
		return this.refsByKey?.get(key);
	}

	cardsInDeck(deckName: string | null): CardRef[] {
		const all = this.cards();
		return deckName === null ? [...all] : all.filter((ref) => isInDeck(ref.deckName, deckName));
	}

	/** Every deck name that holds at least one card. Empty decks (e.g. Anki's "Default") are left out. */
	deckNames(): string[] {
		const names = new Set<string>();
		for (const ref of this.cards()) names.add(ref.deckName);
		return [...names];
	}

	siblings(ref: CardRef): CardRef[] {
		return this.cards().filter((other) => other.pkg === ref.pkg && other.note.id === ref.note.id && other.key !== ref.key);
	}

	progress(ref: CardRef): CardProgress {
		return ref.pkg.progress.cards[ref.card.id] ?? {};
	}

	setProgress(ref: CardRef, progress: CardProgress): void {
		const cleaned: CardProgress = {};
		if (progress.memory) cleaned.memory = progress.memory;
		if (progress.suspended) cleaned.suspended = true;
		if (progress.buriedOn) cleaned.buriedOn = progress.buriedOn;
		if (Object.keys(cleaned).length === 0) delete ref.pkg.progress.cards[ref.card.id];
		else ref.pkg.progress.cards[ref.card.id] = cleaned;
	}

	private index(): void {
		const refs: CardRef[] = [];
		for (const pkg of this.packages.values()) {
			const { data } = pkg;
			for (const card of Object.values(data.cards)) {
				const note = data.notes[card.noteId];
				const noteType = note && data.noteTypes[note.noteTypeId];
				if (!note || !noteType) continue;
				const template = noteType.kind === "cloze" ? noteType.templates[0] : noteType.templates.find((t) => t.ord === card.ord);
				if (!template) continue;
				const deckName = data.decks[card.deckId]?.name ?? "Default";
				refs.push({ key: Collection.cardKey(data.id, card.id), pkg, card, note, noteType, template, deckName });
			}
		}
		this.refs = refs;
		this.refsByKey = new Map(refs.map((ref) => [ref.key, ref]));
	}
}
