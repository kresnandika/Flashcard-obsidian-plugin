import type { ParsedPackage } from "../anki/types";
import type { CardRecord, Note, PackageData } from "../domain/types";

export interface MergeResult {
	notesAdded: number;
	notesUpdated: number;
	cardsAdded: number;
}

/** How many of the parsed notes already exist in a package, matched by guid. */
export function guidOverlap(existing: PackageData, parsed: ParsedPackage): number {
	const guids = new Set(Object.values(existing.notes).map((note) => note.guid));
	return Object.values(parsed.notes).filter((note) => guids.has(note.guid)).length;
}

/**
 * Re-importing a deck updates it in place, like Anki: notes are matched by
 * guid and get the new fields and tags, new notes and cards are added, and
 * existing cards keep their id, deck and therefore their review progress.
 */
export function mergeIntoPackage(target: PackageData, parsed: ParsedPackage, now: number): MergeResult {
	const result: MergeResult = { notesAdded: 0, notesUpdated: 0, cardsAdded: 0 };
	Object.assign(target.noteTypes, parsed.noteTypes);
	for (const deck of Object.values(parsed.decks)) target.decks[deck.id] ??= deck;

	const byGuid = new Map(Object.values(target.notes).map((note) => [note.guid, note]));
	const noteIdMap = new Map<string, string>();
	for (const note of Object.values(parsed.notes)) {
		const existing = byGuid.get(note.guid);
		if (existing) {
			if (existing.modified !== note.modified || existing.fields.join("\x1f") !== note.fields.join("\x1f")) result.notesUpdated++;
			existing.fields = note.fields;
			existing.tags = note.tags;
			existing.noteTypeId = note.noteTypeId;
			existing.modified = note.modified;
			noteIdMap.set(note.id, existing.id);
		} else {
			const id = target.notes[note.id] ? uniqueId(note.id, target.notes) : note.id;
			const added: Note = { ...note, id };
			target.notes[id] = added;
			noteIdMap.set(note.id, id);
			result.notesAdded++;
		}
	}

	const existingCards = new Set(Object.values(target.cards).map((card) => `${card.noteId}:${card.ord}`));
	for (const card of Object.values(parsed.cards)) {
		const noteId = noteIdMap.get(card.noteId);
		if (!noteId || existingCards.has(`${noteId}:${card.ord}`)) continue;
		const id = target.cards[card.id] ? uniqueId(card.id, target.cards) : card.id;
		const added: CardRecord = { ...card, id, noteId };
		target.cards[id] = added;
		result.cardsAdded++;
	}
	target.updatedAt = now;
	return result;
}

function uniqueId(base: string, taken: Record<string, unknown>): string {
	let n = 1;
	while (taken[`${base}-${n}`]) n++;
	return `${base}-${n}`;
}
