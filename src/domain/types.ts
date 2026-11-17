/**
 * Core data model. These shapes are persisted as JSON in the vault (see
 * docs/storage-format.md), so changes here must stay backwards compatible or
 * bump STORAGE_SCHEMA_VERSION with a migration.
 *
 * All ids are strings: Anki ids are millisecond timestamps and are kept as is.
 */

export type NoteTypeKind = "standard" | "cloze";

export interface CardTemplate {
	name: string;
	/** Position of the template within its note type; also the card's `ord`. */
	ord: number;
	front: string;
	back: string;
}

export interface NoteType {
	id: string;
	name: string;
	kind: NoteTypeKind;
	fields: string[];
	templates: CardTemplate[];
	css: string;
	/** Index of the field used as the card's title in lists. */
	sortField: number;
}

export interface Deck {
	id: string;
	/** Full hierarchical name, levels separated by `::` as in Anki. */
	name: string;
}

export interface Note {
	id: string;
	/** Globally unique id from Anki, used to match notes when a deck is re-imported. */
	guid: string;
	noteTypeId: string;
	fields: string[];
	tags: string[];
	modified: number;
}

export interface CardRecord {
	id: string;
	noteId: string;
	deckId: string;
	/** Template index (standard) or cloze number minus one (cloze). */
	ord: number;
	/** Order in which new cards are introduced. */
	position: number;
}

/** One imported `.apkg`: its notes, cards, decks and media. Stored as collection.json. */
export interface PackageData {
	schema: number;
	id: string;
	name: string;
	/** File name the package was imported from. */
	source: string;
	importedAt: number;
	updatedAt: number;
	noteTypes: Record<string, NoteType>;
	decks: Record<string, Deck>;
	notes: Record<string, Note>;
	cards: Record<string, CardRecord>;
	/** Original media file name → stored file name, only for names that had to change. */
	renamedMedia: Record<string, string>;
}

/** Matches ts-fsrs `State`, persisted as a number. */
export enum CardState {
	New = 0,
	Learning = 1,
	Review = 2,
	Relearning = 3,
}

/** Answer buttons, matching ts-fsrs `Rating`. */
export enum Grade {
	Again = 1,
	Hard = 2,
	Good = 3,
	Easy = 4,
}

export const GRADES: readonly Grade[] = [Grade.Again, Grade.Hard, Grade.Good, Grade.Easy];

/** The FSRS memory state of a card that has been reviewed at least once. */
export interface MemoryState {
	due: number;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	learningSteps: number;
	reps: number;
	lapses: number;
	state: CardState;
	lastReview?: number;
}

export interface CardProgress {
	/** Absent while the card is new. */
	memory?: MemoryState;
	suspended?: boolean;
	/** Study day on which the card was buried; it comes back the next day. */
	buriedOn?: string;
}

/** A compact review log row: [time, cardId, grade, stateBefore, durationMs]. */
export type ReviewEntry = [time: number, cardId: string, grade: Grade, stateBefore: CardState, durationMs: number];

/** Scheduling data for one package. Stored as progress.json. */
export interface ProgressData {
	schema: number;
	cards: Record<string, CardProgress>;
	log: ReviewEntry[];
}

/** A package together with its progress, as held in memory. */
export interface LoadedPackage {
	folder: string;
	data: PackageData;
	progress: ProgressData;
}

/** A card resolved against its note, note type and deck. Keys are unique across packages. */
export interface CardRef {
	key: string;
	pkg: LoadedPackage;
	card: CardRecord;
	note: Note;
	noteType: NoteType;
	template: CardTemplate;
	deckName: string;
}
