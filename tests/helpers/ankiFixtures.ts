import JSZip from "jszip";
import { zstdCompressSync } from "node:zlib";
import type { SqlJsStatic } from "sql.js";
import { encode } from "./protobufWriter";
import { testSqlite } from "./sqlite";

export interface FixtureNote {
	id: number;
	guid: string;
	fields: string[];
	tags?: string;
}

export interface FixtureOptions {
	notes?: FixtureNote[];
	media?: Record<string, Uint8Array>;
	css?: string;
}

const MODEL_ID = 1700000000000;
const DEFAULT_NOTES: FixtureNote[] = [
	{ id: 1, guid: "g-love", fields: ["爱", "ài", "to love", "[sound:ai.mp3]", '<img src="ai.jpg">'], tags: "HSK1" },
	{ id: 2, guid: "g-eight", fields: ["八", "bā", "eight", "[sound:ba.mp3]", ""], tags: "HSK1" },
	{ id: 3, guid: "g-dad", fields: ["爸爸", "bàba", "father", "", ""], tags: "HSK1" },
];
const FIELD_NAMES = ["Hanzi", "Pinyin", "Meaning", "Audio", "Image"];
const TEMPLATES = [
	{ name: "Recognition", qfmt: '<div class="hanzi">{{Hanzi}}</div>', afmt: "{{FrontSide}}<hr id=answer>{{Pinyin}}<br>{{Meaning}}{{Audio}}{{Image}}" },
	{ name: "Typing", qfmt: "{{Meaning}}<br>{{type:Hanzi}}", afmt: "{{Meaning}}<hr>{{type:Hanzi}}{{Audio}}" },
];
const DECKS: Record<number, string> = { 1: "Default", 10: "Chinese", 11: "Chinese::HSK 1", 12: "Chinese::HSK 1::Recognition", 13: "Chinese::HSK 1::Typing" };

/** Recognition cards go to deck 12, typing cards to deck 13. */
const DECK_FOR_ORD = [12, 13];

function cardRows(notes: FixtureNote[]) {
	return notes.flatMap((note, index) => TEMPLATES.map((_template, ord) => ({ id: note.id * 10 + ord, nid: note.id, did: DECK_FOR_ORD[ord], ord, due: index + 1 })));
}

function createTables(db: InstanceType<SqlJsStatic["Database"]>): void {
	db.run("CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text)");
	db.run("CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text)");
}

function insertNotesAndCards(db: InstanceType<SqlJsStatic["Database"]>, notes: FixtureNote[]): void {
	for (const note of notes) {
		db.run("INSERT INTO notes VALUES (?, ?, ?, 1, 0, ?, ?, '', 0, 0, '')", [note.id, note.guid, MODEL_ID, ` ${note.tags ?? ""} `, note.fields.join("\x1f")]);
	}
	for (const card of cardRows(notes)) {
		db.run("INSERT INTO cards VALUES (?, ?, ?, ?, 1, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')", [card.id, card.nid, card.did, card.ord, card.due]);
	}
}

/** A legacy (schema 11, collection.anki21) package, as written by "Support older Anki versions". */
export async function legacyApkg(options: FixtureOptions = {}): Promise<Uint8Array> {
	const SQL = await testSqlite();
	const db = new SQL.Database();
	db.run("CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text)");
	createTables(db);
	const model = {
		id: MODEL_ID,
		name: "Chinese (test)",
		type: 0,
		sortf: 0,
		css: options.css ?? ".card { color: red; } .hanzi { font-size: 60px; background: url('bg.png'); }",
		flds: FIELD_NAMES.map((name, ord) => ({ name, ord })),
		tmpls: TEMPLATES.map((template, ord) => ({ ...template, ord })),
	};
	const decks = Object.fromEntries(Object.entries(DECKS).map(([id, name]) => [id, { id: Number(id), name }]));
	db.run("INSERT INTO col VALUES (1, 0, 0, 0, 11, 0, 0, 0, '{}', ?, ?, '{}', '{}')", [JSON.stringify({ [MODEL_ID]: model }), JSON.stringify(decks)]);
	insertNotesAndCards(db, options.notes ?? DEFAULT_NOTES);
	const bytes = db.export();
	db.close();

	const zip = new JSZip();
	zip.file("collection.anki21", bytes);
	zip.file("meta", encode([[1, 2]]));
	const media = options.media ?? { "ai.mp3": new Uint8Array([1, 2, 3]), "ai.jpg": new Uint8Array([4, 5]), "ba.mp3": new Uint8Array([6]) };
	const list: Record<string, string> = {};
	Object.entries(media).forEach(([name, data], index) => {
		list[String(index)] = name;
		zip.file(String(index), data);
	});
	zip.file("media", JSON.stringify(list));
	return zip.generateAsync({ type: "uint8array" });
}

/** A modern (schema 18, zstd-compressed collection.anki21b) package with protobuf metadata. */
export async function modernApkg(): Promise<Uint8Array> {
	const SQL = await testSqlite();
	const db = new SQL.Database();
	db.run("CREATE TABLE notetypes (id integer primary key, name text, mtime_secs integer, usn integer, config blob)");
	db.run("CREATE TABLE fields (ntid integer, ord integer, name text, config blob)");
	db.run("CREATE TABLE templates (ntid integer, ord integer, name text, mtime_secs integer, usn integer, config blob)");
	db.run("CREATE TABLE decks (id integer primary key, name text, mtime_secs integer, usn integer, common blob, kind blob)");
	createTables(db);
	db.run("INSERT INTO notetypes VALUES (?, ?, 0, 0, ?)", [MODEL_ID, "Chinese (modern)", encode([[1, 0], [2, 0], [3, ".card { color: blue; }"]])]);
	FIELD_NAMES.forEach((name, ord) => db.run("INSERT INTO fields VALUES (?, ?, ?, x'')", [MODEL_ID, ord, name]));
	TEMPLATES.forEach((template, ord) => db.run("INSERT INTO templates VALUES (?, ?, ?, 0, 0, ?)", [MODEL_ID, ord, template.name, encode([[1, template.qfmt], [2, template.afmt]])]));
	for (const [id, name] of Object.entries(DECKS)) db.run("INSERT INTO decks VALUES (?, ?, 0, 0, x'', x'')", [Number(id), name.split("::").join("\x1f")]);
	insertNotesAndCards(db, DEFAULT_NOTES);
	const bytes = db.export();
	db.close();

	const zip = new JSZip();
	zip.file("collection.anki21b", zstdCompressSync(bytes));
	zip.file("collection.anki2", new Uint8Array([0]));
	zip.file("meta", encode([[1, 3]]));
	const entries = [encode([[1, "ai.mp3"], [2, 3]]), encode([[1, "ai.jpg"], [2, 2]])];
	zip.file("media", zstdCompressSync(encode(entries.map((entry) => [1, entry] as [number, Uint8Array]))));
	zip.file("0", zstdCompressSync(new Uint8Array([1, 2, 3])));
	zip.file("1", zstdCompressSync(new Uint8Array([4, 5])));
	return zip.generateAsync({ type: "uint8array" });
}
