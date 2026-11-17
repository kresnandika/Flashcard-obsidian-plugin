import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readAnkiPackage } from "../../src/anki/apkgReader";
import { Collection } from "../../src/domain/Collection";
import { renderBack, renderFront } from "../../src/rendering/renderCard";
import { testSqlite } from "../helpers/sqlite";

/**
 * Smoke test against a real deck that isn't part of the repo (decks are
 * usually copyrighted). Run with:
 *
 *   FLASHCARDS_SAMPLE_APKG=/path/to/deck.apkg npm test
 */
const samplePath = process.env.FLASHCARDS_SAMPLE_APKG;

describe.skipIf(!samplePath)("sample package", () => {
	it("imports and renders every card", async () => {
		const parsed = await readAnkiPackage(readFileSync(samplePath as string), "sample.apkg", await testSqlite());
		const collection = new Collection();
		collection.setPackage({
			folder: "Flashcards/sample",
			data: { ...parsed, schema: 1, id: "sample", source: "sample.apkg", importedAt: 0, updatedAt: 0, renamedMedia: {} },
			progress: { schema: 1, cards: {}, log: [] },
		});

		const media = new Set(parsed.media.map((m) => m.name));
		const missing = new Set<string>();
		for (const ref of collection.cards()) {
			const front = renderFront(ref);
			const back = renderBack(ref);
			expect(front.html).not.toContain("Unknown field");
			expect(back.html).not.toContain("Unknown field");
			for (const sound of [...front.sounds, ...back.sounds]) if (!media.has(sound)) missing.add(sound);
			for (const match of back.html.matchAll(/<img[^>]+src="([^"]+)"/g)) if (!media.has(match[1])) missing.add(match[1]);
		}

		console.warn(`${parsed.name}: ${collection.cards().length} cards, ${media.size} media files, ${missing.size} missing references`);
		expect(collection.cards().length).toBeGreaterThan(0);
	});
});
