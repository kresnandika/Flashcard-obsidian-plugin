import { describe, expect, it } from "vitest";
import { readAnkiPackage } from "../../src/anki/apkgReader";
import { legacyApkg, modernApkg } from "../helpers/ankiFixtures";
import { testSqlite } from "../helpers/sqlite";

describe("readAnkiPackage", () => {
	it("reads a legacy collection.anki21 package", async () => {
		const parsed = await readAnkiPackage(await legacyApkg(), "hsk.apkg", await testSqlite());

		expect(parsed.name).toBe("HSK 1");
		expect(Object.keys(parsed.notes)).toHaveLength(3);
		expect(Object.keys(parsed.cards)).toHaveLength(6);

		const noteType = Object.values(parsed.noteTypes)[0];
		expect(noteType.fields).toEqual(["Hanzi", "Pinyin", "Meaning", "Audio", "Image"]);
		expect(noteType.templates.map((t) => t.name)).toEqual(["Recognition", "Typing"]);
		expect(noteType.css).toContain(".hanzi");

		const love = parsed.notes["1"];
		expect(love.fields[0]).toBe("爱");
		expect(love.tags).toEqual(["HSK1"]);
		expect(parsed.cards["10"]).toMatchObject({ noteId: "1", deckId: "12", ord: 0, position: 1 });
		expect(parsed.decks["12"].name).toBe("Chinese::HSK 1::Recognition");
	});

	it("reads media lazily", async () => {
		const parsed = await readAnkiPackage(await legacyApkg(), "hsk.apkg", await testSqlite());
		expect(parsed.media.map((m) => m.name).sort()).toEqual(["ai.jpg", "ai.mp3", "ba.mp3"]);
		const mp3 = parsed.media.find((m) => m.name === "ai.mp3");
		expect([...(await mp3!.read())]).toEqual([1, 2, 3]);
	});

	it("reads a modern zstd-compressed collection.anki21b package", async () => {
		const parsed = await readAnkiPackage(await modernApkg(), "modern.apkg", await testSqlite());
		const noteType = Object.values(parsed.noteTypes)[0];
		expect(noteType.name).toBe("Chinese (modern)");
		expect(noteType.css).toBe(".card { color: blue; }");
		expect(noteType.templates[1].front).toContain("{{type:Hanzi}}");
		expect(parsed.decks["13"].name).toBe("Chinese::HSK 1::Typing");
		expect(Object.keys(parsed.cards)).toHaveLength(6);
		const image = parsed.media.find((m) => m.name === "ai.jpg");
		expect([...(await image!.read())]).toEqual([4, 5]);
	});

	it("rejects files that aren't zip archives", async () => {
		await expect(readAnkiPackage(new TextEncoder().encode("not a zip"), "bad.apkg", await testSqlite())).rejects.toThrow(/isn't a valid Anki package/);
	});
});
