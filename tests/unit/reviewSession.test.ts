import { describe, expect, it } from "vitest";
import { CardState, Grade } from "../../src/domain/types";
import { ReviewSession } from "../../src/scheduling/ReviewSession";
import { Scheduler } from "../../src/scheduling/Scheduler";
import { makeClock, makeCollection, makePackage, settings } from "../helpers/collectionFactory";

function setup(words = 3, overrides = {}) {
	const pkg = makePackage(words);
	const collection = makeCollection(pkg);
	const config = settings({ limits: { newPerDay: 20, reviewsPerDay: 200 }, ...overrides });
	const clock = makeClock();
	const changes: string[] = [];
	const session = new ReviewSession(collection, new Scheduler(config.scheduler), config, "Lang::Level::Recognition", (ids) => changes.push(...ids), clock.now);
	return { pkg, collection, session, clock, changes };
}

describe("ReviewSession", () => {
	it("introduces new cards in order and logs answers", () => {
		const { session, pkg, changes } = setup();
		expect(session.next()?.card.id).toBe("c1r");
		session.answer(Grade.Good, 4000);
		expect(pkg.progress.log).toHaveLength(1);
		expect(pkg.progress.log[0]).toMatchObject([expect.any(Number), "c1r", Grade.Good, CardState.New, 4000]);
		expect(pkg.progress.cards.c1r.memory?.state).toBe(CardState.Learning);
		expect(changes).toContain("p1");
		expect(session.next()?.card.id).toBe("c2r");
	});

	it("brings learning cards back when they're due", () => {
		const { session, clock } = setup(1);
		session.next();
		session.answer(Grade.Again, 1000);
		expect(session.counts()).toMatchObject({ newCount: 0, learnCount: 1 });
		// Due in a minute: shown thanks to the learn-ahead window.
		expect(session.next()?.card.id).toBe("c1r");
		clock.advance(60_000);
		session.answer(Grade.Good, 1000);
		expect(session.nextLearningDue()).not.toBeNull();
	});

	it("graduates a card with Easy and finishes the session", () => {
		const { session, pkg } = setup(1);
		session.next();
		session.answer(Grade.Easy, 1000);
		expect(pkg.progress.cards.c1r.memory?.state).toBe(CardState.Review);
		expect(session.next()).toBeNull();
		expect(session.nextLearningDue()).toBeNull();
	});

	it("undo restores progress, the log and the queue", () => {
		const { session, pkg } = setup(2);
		session.next();
		session.answer(Grade.Good, 1000);
		expect(session.undo()?.card.id).toBe("c1r");
		expect(pkg.progress.log).toHaveLength(0);
		expect(pkg.progress.cards.c1r).toBeUndefined();
		expect(session.current?.card.id).toBe("c1r");
		expect(session.counts().newCount).toBe(1);
	});

	it("bury and suspend take the card out and can be undone", () => {
		const { session, pkg } = setup(2);
		session.next();
		session.buryCurrent();
		expect(pkg.progress.cards.c1r.buriedOn).toBe("2026-03-10");
		expect(session.next()?.card.id).toBe("c2r");
		session.suspendCurrent();
		expect(pkg.progress.cards.c2r.suspended).toBe(true);
		session.undo();
		session.undo();
		expect(pkg.progress.cards.c1r).toBeUndefined();
		expect(pkg.progress.cards.c2r).toBeUndefined();
	});

	it("shows intervals for every button", () => {
		const { session } = setup(1);
		session.next();
		const preview = session.preview();
		expect(preview?.[Grade.Again].intervalMs).toBe(60_000);
		expect(preview?.[Grade.Easy].intervalMs).toBeGreaterThan(86_400_000);
	});
});
