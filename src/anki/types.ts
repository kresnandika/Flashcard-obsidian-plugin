import type { CardRecord, Deck, Note, NoteType } from "../domain/types";

/** A media file inside a package, read lazily so large decks don't sit in memory twice. */
export interface PackageMedia {
	name: string;
	read(): Promise<Uint8Array>;
}

/** The contents of an Anki package, converted to the plugin's model. */
export interface ParsedPackage {
	name: string;
	noteTypes: Record<string, NoteType>;
	decks: Record<string, Deck>;
	notes: Record<string, Note>;
	cards: Record<string, CardRecord>;
	media: PackageMedia[];
}

/** The tables of an Anki collection, independent of the schema version. */
export interface CollectionContent {
	noteTypes: Record<string, NoteType>;
	decks: Record<string, Deck>;
	notes: Record<string, Note>;
	cards: Record<string, CardRecord>;
}
