import { describe, expect, it } from "vitest";
import { renderTemplate, type TemplateContext } from "../../src/rendering/templateEngine";

const context = (overrides: Partial<TemplateContext> = {}): TemplateContext => ({
	fields: { Front: "爱", Back: "to love", Empty: "", Extra: "<b>bold</b>" },
	side: "front",
	tags: ["HSK1", "verb"],
	deckName: "Chinese::HSK 1",
	noteTypeName: "Basic",
	cardName: "Card 1",
	...overrides,
});

describe("renderTemplate", () => {
	it("substitutes fields and special fields", () => {
		expect(renderTemplate("{{Front}} – {{Tags}} – {{Deck}} – {{Subdeck}} – {{Card}} – {{Type}}", context())).toBe("爱 – HSK1 verb – Chinese::HSK 1 – HSK 1 – Card 1 – Basic");
	});

	it("renders sections and inverted sections", () => {
		const template = "{{#Back}}yes{{/Back}}{{^Empty}} none{{/Empty}}{{#Empty}} never{{/Empty}}";
		expect(renderTemplate(template, context())).toBe("yes none");
	});

	it("treats a field that only holds an image as non-empty", () => {
		expect(renderTemplate("{{#Pic}}has{{/Pic}}", context({ fields: { Pic: '<img src="a.png">' } }))).toBe("has");
	});

	it("inserts the front side on the back", () => {
		expect(renderTemplate("{{FrontSide}}<hr>{{Back}}", context({ side: "back", frontSide: "Q" }))).toBe("Q<hr>to love");
	});

	it("applies filters right to left", () => {
		expect(renderTemplate("{{text:Extra}}", context())).toBe("bold");
		expect(renderTemplate("{{hint:Back}}", context())).toContain('data-fc-hint="fc-hint-1"');
		expect(renderTemplate("{{furigana:R}}", context({ fields: { R: "漢字[かんじ]" } }))).toBe("<ruby><rb>漢字</rb><rt>かんじ</rt></ruby>");
		expect(renderTemplate("{{kana:R}}", context({ fields: { R: "漢字[かんじ]" } }))).toBe("かんじ");
	});

	it("renders type-in answers as an input, then a comparison", () => {
		expect(renderTemplate("{{type:Front}}", context())).toContain('id="typeans"');
		expect(renderTemplate("{{type:Front}}", context({ side: "back", typedAnswer: "爱" }))).toContain('class="typeGood"');
		expect(renderTemplate("{{type:Front}}", context({ side: "back", typedAnswer: "我" }))).toContain('class="typeBad"');
	});

	it("renders cloze deletions for the card's ordinal", () => {
		const fields = { Text: "{{c1::Paris}} is in {{c2::France::country}}" };
		const front = renderTemplate("{{cloze:Text}}", context({ fields, clozeOrdinal: 2 }));
		expect(front).toContain(">[country]<");
		expect(front).toContain('class="cloze-inactive" data-ordinal="1">Paris');
		const back = renderTemplate("{{cloze:Text}}", context({ fields, clozeOrdinal: 2, side: "back" }));
		expect(back).toContain('<span class="cloze" data-ordinal="2">France</span>');
		expect(renderTemplate("{{#c2}}second{{/c2}}{{#c1}}first{{/c1}}", context({ fields, clozeOrdinal: 2 }))).toBe("second");
	});

	it("flags unknown fields instead of failing", () => {
		expect(renderTemplate("{{Nope}}", context())).toContain("Unknown field: Nope");
	});

	it("tolerates mismatched section tags", () => {
		expect(renderTemplate("{{#Front}}a{{/Typo}}b", context())).toBe("ab");
	});
});
