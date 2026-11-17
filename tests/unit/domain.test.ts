import { describe, expect, it } from "vitest";
import { buildDeckTree, flattenDeckTree, isInDeck, resolveDeckName } from "../../src/domain/deckTree";
import { parseSteps, resolveSettings } from "../../src/settings/settings";
import { slugify, stripHtml } from "../../src/utils/strings";
import { addDays, daysBetween, formatInterval, studyDayKey } from "../../src/utils/time";

describe("deck tree", () => {
	const names = ["HSK::HSK 2::Typing", "HSK::HSK 1::Typing", "HSK::HSK 1::Recognition", "Other"];

	it("builds a sorted tree with implied parents", () => {
		const flat = flattenDeckTree(buildDeckTree(names)).map((node) => `${node.depth}:${node.label}`);
		expect(flat).toEqual(["0:HSK", "1:HSK 1", "2:Recognition", "2:Typing", "1:HSK 2", "2:Typing", "0:Other"]);
	});

	it("hides children of collapsed decks", () => {
		expect(flattenDeckTree(buildDeckTree(names), new Set(["HSK"])).map((node) => node.name)).toEqual(["HSK", "Other"]);
	});

	it("matches sub-decks without matching similar names", () => {
		expect(isInDeck("HSK::HSK 1::Typing", "HSK::HSK 1")).toBe(true);
		expect(isInDeck("HSK::HSK 10", "HSK::HSK 1")).toBe(false);
	});

	it("resolves short deck names", () => {
		expect(resolveDeckName(names, "HSK 1")).toBe("HSK::HSK 1");
		expect(resolveDeckName(["A::HSK 1 (300 Words)::Typing"], "HSK 1")).toBe("A::HSK 1 (300 Words)");
		expect(resolveDeckName(names, "Nope")).toBe("Nope");
	});
});

describe("time", () => {
	it("starts the study day at the configured hour", () => {
		expect(studyDayKey(new Date(2026, 0, 2, 3, 59), 4)).toBe("2026-01-01");
		expect(studyDayKey(new Date(2026, 0, 2, 4, 0), 4)).toBe("2026-01-02");
	});

	it("does day arithmetic across months", () => {
		expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
		expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
	});

	it("formats intervals compactly", () => {
		expect(formatInterval(30_000)).toBe("<1m");
		expect(formatInterval(10 * 60_000)).toBe("10m");
		expect(formatInterval(3 * 86_400_000)).toBe("3d");
		expect(formatInterval(45 * 86_400_000)).toBe("1.5mo");
	});
});

describe("settings and strings", () => {
	it("fills missing settings with defaults", () => {
		const settings = resolveSettings({ limits: { newPerDay: 5 }, scheduler: { desiredRetention: 0.85 } });
		expect(settings.limits).toEqual({ newPerDay: 5, reviewsPerDay: 200 });
		expect(settings.scheduler.desiredRetention).toBe(0.85);
		expect(settings.scheduler.learningSteps).toEqual(["1m", "10m"]);
	});

	it("validates learning steps", () => {
		expect(parseSteps("1m, 10m 1d")).toEqual(["1m", "10m", "1d"]);
		expect(parseSteps("1 minute")).toBeNull();
	});

	it("strips HTML and makes safe folder names", () => {
		expect(stripHtml("<b>爱</b>&nbsp;<br>love")).toBe("爱  love");
		expect(slugify("HSK 1: Words/Typing")).toBe("HSK 1 Words Typing");
	});
});
