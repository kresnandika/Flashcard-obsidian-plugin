import { Collection } from "../../src/domain/Collection";
import type { LoadedPackage, PackageData } from "../../src/domain/types";
import { DEFAULT_SETTINGS, resolveSettings, type FlashcardsSettings } from "../../src/settings/settings";

/**
 * A package with `words` notes and two templates (recognition, typing), each
 * in its own sub-deck of "Lang::Level".
 */
export function makePackage(words: number, id = "p1"): LoadedPackage {
	const data: PackageData = {
		schema: 1,
		id,
		name: "Level",
		source: "test.apkg",
		importedAt: 0,
		updatedAt: 0,
		noteTypes: {
			nt: {
				id: "nt",
				name: "Vocab",
				kind: "standard",
				fields: ["Word", "Meaning"],
				templates: [
					{ name: "Recognition", ord: 0, front: "{{Word}}", back: "{{Meaning}}" },
					{ name: "Typing", ord: 1, front: "{{Meaning}}", back: "{{Word}}" },
				],
				css: "",
				sortField: 0,
			},
		},
		decks: { r: { id: "r", name: "Lang::Level::Recognition" }, t: { id: "t", name: "Lang::Level::Typing" } },
		notes: {},
		cards: {},
		renamedMedia: {},
	};
	for (let i = 1; i <= words; i++) {
		data.notes[`n${i}`] = { id: `n${i}`, guid: `g${i}`, noteTypeId: "nt", fields: [`w${i}`, `m${i}`], tags: [], modified: 0 };
		data.cards[`c${i}r`] = { id: `c${i}r`, noteId: `n${i}`, deckId: "r", ord: 0, position: i };
		data.cards[`c${i}t`] = { id: `c${i}t`, noteId: `n${i}`, deckId: "t", ord: 1, position: i };
	}
	return { folder: `Flashcards/${id}`, data, progress: { schema: 1, cards: {}, log: [] } };
}

export function makeCollection(...packages: LoadedPackage[]): Collection {
	const collection = new Collection();
	packages.forEach((pkg) => collection.setPackage(pkg));
	return collection;
}

export function settings(overrides: Partial<FlashcardsSettings> = {}): FlashcardsSettings {
	return { ...resolveSettings({}), ...overrides, scheduler: { ...DEFAULT_SETTINGS.scheduler, enableFuzz: false, ...overrides.scheduler } };
}

/** A mutable clock for deterministic sessions. 2026-03-10 10:00 local time. */
export function makeClock(start = new Date(2026, 2, 10, 10, 0).getTime()) {
	let now = start;
	return {
		now: () => now,
		advance: (ms: number) => (now += ms),
		set: (time: number) => (now = time),
	};
}
