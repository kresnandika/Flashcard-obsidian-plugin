import type { Database } from "sql.js";
import type { Deck, NoteType } from "../domain/types";
import { readCards, readNotes } from "./collectionRows";
import { ProtoMessage } from "./protobuf";
import { asBytes, asNumber, asString, queryAll } from "./sqlite";
import type { CollectionContent } from "./types";

/** Field numbers in Anki's `notetypes.proto`. */
const NOTETYPE_CONFIG = { kind: 1, sortFieldIndex: 2, css: 3 } as const;
const TEMPLATE_CONFIG = { questionFormat: 1, answerFormat: 2 } as const;

/** Modern collections store deck levels separated by the unit separator. */
const MODERN_DECK_SEPARATOR = "\x1f";

/**
 * Reads `collection.anki21b` (schema 18), where note types, fields, templates
 * and decks are normalised tables with protobuf config blobs.
 */
export function readModernCollection(db: Database): CollectionContent {
	const fieldsByType = new Map<string, { ord: number; name: string }[]>();
	for (const row of queryAll(db, "SELECT ntid, ord, name FROM fields")) {
		const id = asString(row.ntid);
		const list = fieldsByType.get(id) ?? [];
		list.push({ ord: asNumber(row.ord), name: asString(row.name) });
		fieldsByType.set(id, list);
	}

	const templatesByType = new Map<string, NoteType["templates"]>();
	for (const row of queryAll(db, "SELECT ntid, ord, name, config FROM templates")) {
		const id = asString(row.ntid);
		const config = ProtoMessage.decode(asBytes(row.config));
		const list = templatesByType.get(id) ?? [];
		list.push({
			name: asString(row.name),
			ord: asNumber(row.ord),
			front: config.string(TEMPLATE_CONFIG.questionFormat),
			back: config.string(TEMPLATE_CONFIG.answerFormat),
		});
		templatesByType.set(id, list);
	}

	const noteTypes: Record<string, NoteType> = {};
	for (const row of queryAll(db, "SELECT id, name, config FROM notetypes")) {
		const id = asString(row.id);
		const config = ProtoMessage.decode(asBytes(row.config));
		noteTypes[id] = {
			id,
			name: asString(row.name),
			kind: config.number(NOTETYPE_CONFIG.kind) === 1 ? "cloze" : "standard",
			fields: (fieldsByType.get(id) ?? []).sort((a, b) => a.ord - b.ord).map((field) => field.name),
			templates: (templatesByType.get(id) ?? []).sort((a, b) => a.ord - b.ord),
			css: config.string(NOTETYPE_CONFIG.css),
			sortField: config.number(NOTETYPE_CONFIG.sortFieldIndex),
		};
	}

	const decks: Record<string, Deck> = {};
	for (const row of queryAll(db, "SELECT id, name FROM decks")) {
		const id = asString(row.id);
		decks[id] = { id, name: asString(row.name).split(MODERN_DECK_SEPARATOR).join("::") };
	}

	return { noteTypes, decks, notes: readNotes(db), cards: readCards(db) };
}
