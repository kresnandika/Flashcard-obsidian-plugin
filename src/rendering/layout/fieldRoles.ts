import type { NoteType } from "../../domain/types";

/**
 * What a note field means to the built-in card layout. Decks name their
 * fields freely ("Hanzi", "Expression", "Front"…), so roles are detected
 * from names and contents, and can be corrected per note type in settings.
 */
export type FieldRole =
	| "word"
	| "reading"
	| "meaning"
	| "partOfSpeech"
	| "example"
	| "exampleReading"
	| "exampleMeaning"
	| "image"
	| "audio"
	| "exampleAudio";

export const FIELD_ROLES: readonly FieldRole[] = [
	"word",
	"reading",
	"meaning",
	"partOfSpeech",
	"example",
	"exampleReading",
	"exampleMeaning",
	"image",
	"audio",
	"exampleAudio",
];

export const ROLE_LABELS: Record<FieldRole, string> = {
	word: "Word",
	reading: "Reading (pinyin, kana…)",
	meaning: "Meaning",
	partOfSpeech: "Part of speech",
	example: "Example sentence",
	exampleReading: "Example reading",
	exampleMeaning: "Example translation",
	image: "Image",
	audio: "Word audio",
	exampleAudio: "Example audio",
};

/** Role → field index. A missing role isn't shown. */
export type RoleMap = Partial<Record<FieldRole, number>>;

const EXAMPLE = /(sentence|example|context|usage)/;

/**
 * Rules are tried in order and each role is taken by the first matching
 * field, so compound names ("SentencePinyin") are claimed before the
 * simple roles ("Pinyin") can grab them.
 */
const NAME_RULES: [FieldRole, (name: string) => boolean][] = [
	["exampleAudio", (n) => EXAMPLE.test(n) && /(audio|sound)/.test(n)],
	["exampleReading", (n) => EXAMPLE.test(n) && /(pinyin|reading|kana|furigana|romaji|romanization|ipa)/.test(n)],
	["exampleMeaning", (n) => EXAMPLE.test(n) && /(meaning|translation|english|gloss|definition)/.test(n)],
	["audio", (n) => /(audio|sound|pronunciationaudio)/.test(n)],
	["image", (n) => /(image|picture|photo|img|illustration)/.test(n)],
	["partOfSpeech", (n) => /(partofspeech|^pos$|wordtype|wordclass|grammar)/.test(n)],
	["example", (n) => EXAMPLE.test(n)],
	["reading", (n) => /(pinyin|reading|pronunciation|kana|furigana|romaji|romanization|ipa|zhuyin|jyutping)/.test(n)],
	["meaning", (n) => /(meaning|english|definition|translation|gloss|back|answer|sense)/.test(n)],
	["word", (n) => /(hanzi|simplified|traditional|word|expression|front|character|kanji|vocab|term|headword|question|target)/.test(n)],
];

function normalise(name: string): string {
	return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Guesses roles for a note type from its field names, then from sample
 * contents (a field of `[sound:…]` is audio, an `<img>` is an image).
 */
export function detectRoles(noteType: NoteType, sampleFields: string[] = []): RoleMap {
	const roles: RoleMap = {};
	const taken = new Set<number>();
	const names = noteType.fields.map(normalise);

	for (const [role, matches] of NAME_RULES) {
		const index = names.findIndex((name, i) => !taken.has(i) && matches(name));
		if (index >= 0) {
			roles[role] = index;
			taken.add(index);
		}
	}

	sampleFields.forEach((value, index) => {
		if (taken.has(index)) return;
		if (/^\s*\[sound:[^\]]+\]\s*$/.test(value) && roles.audio === undefined) {
			roles.audio = index;
			taken.add(index);
		} else if (/^\s*<img\b[^>]*>\s*$/i.test(value) && roles.image === undefined) {
			roles.image = index;
			taken.add(index);
		}
	});

	// Basic note types ("Front"/"Back" or unnamed): fall back to position.
	if (roles.word === undefined) {
		const index = taken.has(noteType.sortField) ? noteType.fields.findIndex((_, i) => !taken.has(i)) : noteType.sortField;
		if (index >= 0) {
			roles.word = index;
			taken.add(index);
		}
	}
	if (roles.meaning === undefined) {
		const index = noteType.fields.findIndex((_, i) => !taken.has(i));
		if (index >= 0) roles.meaning = index;
	}
	return roles;
}

/** Detected roles with the user's corrections applied (null removes a role). */
export function resolveRoles(detected: RoleMap, overrides: Partial<Record<FieldRole, number | null>> | undefined): RoleMap {
	const roles: RoleMap = { ...detected };
	for (const role of FIELD_ROLES) {
		const override = overrides?.[role];
		if (override === null) delete roles[role];
		else if (typeof override === "number") roles[role] = override;
	}
	return roles;
}

/** The built-in layout needs at least a word and a meaning. */
export function canUseBuiltinLayout(roles: RoleMap): boolean {
	return roles.word !== undefined && roles.meaning !== undefined;
}
