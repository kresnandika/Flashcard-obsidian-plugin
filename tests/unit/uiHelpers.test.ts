import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ Menu: class {}, setIcon: () => undefined, Modal: class {}, Setting: class {} }));

const { tabLabel } = await import("../../src/ui/screens/HomeScreen");
const { guideWords, headword } = await import("../../src/ui/components/guideWords");
const { buildQueue } = await import("../../src/scheduling/queue");
const { makeClock, makeCollection, makePackage, settings } = await import("../helpers/collectionFactory");

describe("thumb tab labels", () => {
	it("uses the level number when there is one", () => {
		expect(tabLabel("HSK 1 (300 Words)")).toBe("1");
		expect(tabLabel("Spanish")).toBe("Sp");
		expect(tabLabel("日本語")).toBe("日本");
	});
});

describe("guide words", () => {
	it("names the first and last card of today's queue", () => {
		const collection = makeCollection(makePackage(5));
		const queue = buildQueue(collection, "Lang::Level::Recognition", settings({ limits: { newPerDay: 3, reviewsPerDay: 10 } }), makeClock().now());
		expect(guideWords(queue)).toEqual({ first: { text: "w1", reading: "m1" }, last: { text: "w3", reading: "m3" } });
	});

	it("drops long readings and ignores sound tags", () => {
		const [ref] = makeCollection(makePackage(1)).cards();
		ref.note.fields = ["[sound:a.mp3]爱", "a reading that is much too long to fit"];
		expect(headword(ref)).toEqual({ text: "爱", reading: null });
	});
});
