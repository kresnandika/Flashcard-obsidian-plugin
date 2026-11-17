import { describe, expect, it } from "vitest";
import { CardState, Grade, type ReviewEntry } from "../../src/domain/types";
import { cardBreakdown, dueForecast, reviewSummary } from "../../src/stats/statistics";
import { makeClock, makeCollection, makePackage } from "../helpers/collectionFactory";

const DAY = 86_400_000;

describe("reviewSummary", () => {
	it("counts today, the streak and retention", () => {
		const now = makeClock().now();
		const entries: ReviewEntry[] = [
			[now - 3 * DAY, "a", Grade.Good, CardState.Review, 1000],
			[now - 2 * DAY, "a", Grade.Again, CardState.Review, 1000],
			[now - 1 * DAY, "a", Grade.Good, CardState.Review, 1000],
			[now - 60_000, "b", Grade.Good, CardState.New, 90_000],
		];
		const summary = reviewSummary(entries, now, 4);
		expect(summary.reviewsToday).toBe(1);
		expect(summary.minutesToday).toBe(2);
		expect(summary.streak).toBe(4);
		expect(summary.retention30d).toBeCloseTo(2 / 3);
	});

	it("keeps yesterday's streak alive before the first review today", () => {
		const now = makeClock().now();
		const summary = reviewSummary([[now - DAY, "a", Grade.Good, CardState.Review, 0]], now, 4);
		expect(summary.streak).toBe(1);
	});
});

describe("cardBreakdown and dueForecast", () => {
	it("splits cards by state and forecasts reviews", () => {
		const pkg = makePackage(3);
		const now = makeClock().now();
		const memory = (scheduledDays: number, due: number, state = CardState.Review) => ({ due, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays, learningSteps: 0, reps: 1, lapses: 0, state });
		pkg.progress.cards.c1r = { memory: memory(30, now + 2 * DAY) };
		pkg.progress.cards.c2r = { memory: memory(3, now - DAY) };
		pkg.progress.cards.c3r = { memory: memory(0, now + 60_000, CardState.Learning) };
		pkg.progress.cards.c1t = { suspended: true };
		const collection = makeCollection(pkg);

		expect(cardBreakdown(collection, null)).toEqual({ total: 6, new: 2, learning: 1, young: 1, mature: 1, suspended: 1 });
		expect(dueForecast(collection, null, now, 4, 4)).toEqual([2, 0, 1, 0]);
	});
});
