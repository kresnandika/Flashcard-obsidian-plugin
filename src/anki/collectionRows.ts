import type { Database } from "sql.js";
import type { CardRecord, Note } from "../domain/types";
import { asNumber, asString, queryAll } from "./sqlite";

/** Anki separates note fields with the unit separator character. */
const FIELD_SEPARATOR = "\x1f";

/** Reads the `notes` table, which has the same shape in every schema version. */
export function readNotes(db: Database): Record<string, Note> {
	const notes: Record<string, Note> = {};
	for (const row of queryAll(db, "SELECT id, guid, mid, mod, tags, flds FROM notes")) {
		const id = asString(row.id);
		notes[id] = {
			id,
			guid: asString(row.guid),
			noteTypeId: asString(row.mid),
			fields: asString(row.flds).split(FIELD_SEPARATOR),
			tags: asString(row.tags).split(/\s+/).filter(Boolean),
			modified: asNumber(row.mod),
		};
	}
	return notes;
}

/**
 * Reads the `cards` table. Cards in a filtered deck are put back in their home
 * deck. New cards keep their Anki position; others are placed after them.
 */
export function readCards(db: Database): Record<string, CardRecord> {
	const cards: Record<string, CardRecord> = {};
	const rows = queryAll(db, "SELECT id, nid, did, odid, ord, type, due FROM cards");
	rows.forEach((row, index) => {
		const id = asString(row.id);
		const homeDeck = asNumber(row.odid) !== 0 ? row.odid : row.did;
		cards[id] = {
			id,
			noteId: asString(row.nid),
			deckId: asString(homeDeck),
			ord: asNumber(row.ord),
			position: asNumber(row.type) === 0 ? asNumber(row.due) : 1_000_000_000 + index,
		};
	});
	return cards;
}
