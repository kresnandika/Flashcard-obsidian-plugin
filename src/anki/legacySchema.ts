import type { Database } from "sql.js";
import type { Deck, NoteType } from "../domain/types";
import { readCards, readNotes } from "./collectionRows";
import { asString, queryAll } from "./sqlite";
import type { CollectionContent } from "./types";

interface LegacyModel {
	id: number | string;
	name: string;
	type: number;
	sortf?: number;
	css?: string;
	flds: { name: string; ord: number }[];
	tmpls: { name: string; ord: number; qfmt: string; afmt: string }[];
}

interface LegacyDeck {
	id: number | string;
	name: string;
}

/**
 * Reads `collection.anki2` / `collection.anki21` (schema 11), where note types
 * and decks are JSON blobs in the single `col` row.
 */
export function readLegacyCollection(db: Database): CollectionContent {
	const [col] = queryAll(db, "SELECT models, decks FROM col");
	if (!col) throw new Error("The collection has no `col` row.");

	const models = JSON.parse(asString(col.models)) as Record<string, LegacyModel>;
	const decks = JSON.parse(asString(col.decks)) as Record<string, LegacyDeck>;

	const noteTypes: Record<string, NoteType> = {};
	for (const model of Object.values(models)) {
		const id = String(model.id);
		noteTypes[id] = {
			id,
			name: model.name,
			kind: model.type === 1 ? "cloze" : "standard",
			fields: [...model.flds].sort((a, b) => a.ord - b.ord).map((field) => field.name),
			templates: [...model.tmpls]
				.sort((a, b) => a.ord - b.ord)
				.map((template) => ({ name: template.name, ord: template.ord, front: template.qfmt, back: template.afmt })),
			css: model.css ?? "",
			sortField: model.sortf ?? 0,
		};
	}

	const deckMap: Record<string, Deck> = {};
	for (const deck of Object.values(decks)) deckMap[String(deck.id)] = { id: String(deck.id), name: deck.name };

	return { noteTypes, decks: deckMap, notes: readNotes(db), cards: readCards(db) };
}
