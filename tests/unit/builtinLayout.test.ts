import { describe, expect, it } from "vitest";
import type { CardRef, NoteType } from "../../src/domain/types";
import { tidyList } from "../../src/rendering/layout/builtinLayout";
import { detectCardKind } from "../../src/rendering/layout/cardKind";
import { canUseBuiltinLayout, detectRoles, resolveRoles } from "../../src/rendering/layout/fieldRoles";
import { renderBack, renderFront } from "../../src/rendering/renderCard";
import { makeCollection, makePackage, settings } from "../helpers/collectionFactory";

const hsk: NoteType = {
	id: "hsk",
	name: "HSK Deck",
	kind: "standard",
	fields: ["Hanzi", "Pinyin", "Part of Speech", "Meaning", "SentenceHanzi", "SentencePinyin", "SentenceMeaning", "AudioHanzi", "AudioSentence", "Image"],
	templates: [
		{ name: "Recognition", ord: 0, front: '<div>{{Hanzi}}</div><textarea id="answerBox"></textarea>{{SentenceHanzi}}', back: "…" },
		{ name: "Typing", ord: 1, front: '{{Part of Speech}}{{Meaning}}<textarea></textarea>{{SentenceMeaning}}<script>const key = "typing_" + "{{Hanzi}}";</script>', back: "…" },
		{ name: "Writing", ord: 2, front: '{{Meaning}}<canvas id="drawCanvas"></canvas>', back: "…" },
	],
	css: "",
	sortField: 0,
};

describe("detectRoles", () => {
	it("maps the HSK deck's fields", () => {
		expect(detectRoles(hsk)).toEqual({
			word: 0,
			reading: 1,
			partOfSpeech: 2,
			meaning: 3,
			example: 4,
			exampleReading: 5,
			exampleMeaning: 6,
			audio: 7,
			exampleAudio: 8,
			image: 9,
		});
	});

	it("handles Anki's Basic note type and content hints", () => {
		const basic: NoteType = { ...hsk, fields: ["Front", "Back", "Extra"], templates: [] };
		const roles = detectRoles(basic, ["猫", "cat", "[sound:cat.mp3]"]);
		expect(roles).toMatchObject({ word: 0, meaning: 1, audio: 2 });
		expect(canUseBuiltinLayout(roles)).toBe(true);
	});

	it("applies user corrections", () => {
		expect(resolveRoles({ word: 0, meaning: 1, image: 2 }, { image: null, meaning: 3 })).toEqual({ word: 0, meaning: 3 });
	});
});

describe("detectCardKind", () => {
	const roles = detectRoles(hsk);
	it("reads direction and input from the deck's front templates", () => {
		expect(detectCardKind(hsk, hsk.templates[0], roles)).toEqual({ direction: "recognition", input: "type" });
		expect(detectCardKind(hsk, hsk.templates[1], roles)).toEqual({ direction: "production", input: "type" });
		expect(detectCardKind(hsk, hsk.templates[2], roles)).toEqual({ direction: "production", input: "draw" });
	});
});

describe("built-in layout", () => {
	const options = settings();
	const ref = (): CardRef => makeCollection(makePackage(1)).cards()[0];

	it("asks with the word and answers with a dictionary entry", () => {
		const card = ref();
		card.note.fields = ["猫", "the cat [sound:mao.mp3]"];
		const front = renderFront(card, options);
		expect(front.builtin).toBe(true);
		expect(front.html).toContain('class="fc-entry-word">猫');
		expect(front.html).not.toContain("the cat");
		const back = renderBack(card, "", options);
		expect(back.html).toContain("fc-entry-meaning");
		expect(back.css).toContain(".fc-entry");
	});

	it("falls back to the deck design when asked to", () => {
		const card = ref();
		const front = renderFront(card, { cardStyle: "flashcards", noteTypeLayouts: { nt: { style: "deck" } } });
		expect(front.builtin).toBe(false);
		expect(front.html).toBe("w1");
	});
});

describe("tidyList", () => {
	it("sets Latin part-of-speech lists on one line", () => {
		expect(tidyList("adjective、 preposition、<br>（verb、<br>classifier）")).toBe("adjective, preposition, (verb, classifier)");
		expect(tidyList("动词、名词")).toBe("动词、名词");
	});
});
