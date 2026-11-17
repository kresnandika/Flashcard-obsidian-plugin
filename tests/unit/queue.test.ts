import { describe, expect, it } from "vitest";
import { buildQueue, deckCounts } from "../../src/scheduling/queue";
import { CardState } from "../../src/domain/types";
import { makeClock, makeCollection, makePackage, settings } from "../helpers/collectionFactory";

describe("buildQueue", () => {
	it("limits new cards per day and gathers them deck by deck", () => {
		const collection = makeCollection(makePackage(30));
		const queue = buildQueue(collection, "Lang::Level", settings({ limits: { newPerDay: 5, reviewsPerDay: 100 } }), makeClock().now());
		expect(queue.newCards.map((ref) => ref.card.id)).toEqual(["c1r", "c2r", "c3r", "c4r", "c5r"]);
	});

	it("gathers by position across decks, burying siblings", () => {
		const collection = makeCollection(makePackage(10));
		const queue = buildQueue(collection, "Lang", settings({ newCardGather: "position", limits: { newPerDay: 4, reviewsPerDay: 100 } }), makeClock().now());
		expect(queue.newCards.map((ref) => ref.card.id)).toEqual(["c1r", "c2r", "c3r", "c4r"]);
	});

	it("shows siblings together when burying is off", () => {
		const collection = makeCollection(makePackage(10));
		const queue = buildQueue(collection, "Lang", settings({ newCardGather: "position", buryNewSiblings: false, limits: { newPerDay: 4, reviewsPerDay: 100 } }), makeClock().now());
		expect(queue.newCards.map((ref) => ref.card.id)).toEqual(["c1r", "c1t", "c2r", "c2t"]);
	});

	it("counts new cards already introduced today against the limit", () => {
		const pkg = makePackage(10);
		const clock = makeClock();
		pkg.progress.log.push([clock.now() - 60_000, "c9r", 3, CardState.New, 1000]);
		pkg.progress.cards.c9r = { memory: { due: clock.now() + 86_400_000 * 3, stability: 3, difficulty: 5, elapsedDays: 0, scheduledDays: 3, learningSteps: 0, reps: 1, lapses: 0, state: CardState.Review } };
		const queue = buildQueue(makeCollection(pkg), "Lang::Level::Recognition", settings({ limits: { newPerDay: 3, reviewsPerDay: 100 } }), clock.now());
		expect(queue.newCards).toHaveLength(2);
	});

	it("includes due reviews and skips suspended and buried cards", () => {
		const pkg = makePackage(4);
		const clock = makeClock();
		const review = (due: number) => ({ memory: { due, stability: 5, difficulty: 5, elapsedDays: 5, scheduledDays: 5, learningSteps: 0, reps: 3, lapses: 0, state: CardState.Review } });
		pkg.progress.cards.c1r = review(clock.now() - 1000);
		pkg.progress.cards.c2r = review(clock.now() + 3 * 3600_000); // later today still counts
		pkg.progress.cards.c3r = { ...review(clock.now() - 1000), suspended: true };
		pkg.progress.cards.c4r = { buriedOn: "2026-03-10" };
		const queue = buildQueue(makeCollection(pkg), "Lang::Level::Recognition", settings(), clock.now());
		expect(queue.reviewCards.map((ref) => ref.card.id)).toEqual(["c1r", "c2r"]);
		expect(queue.newCards).toHaveLength(0);
	});

	it("uses per-deck limit overrides", () => {
		const collection = makeCollection(makePackage(30));
		const counts = deckCounts(collection, "Lang::Level::Typing", settings({ deckLimits: { "Lang::Level::Typing": { newPerDay: 2 } } }), makeClock().now());
		expect(counts.newCount).toBe(2);
	});
});
