import type { Collection } from "../domain/Collection";
import { CardState, type CardProgress, type CardRef, type Grade, type ReviewEntry } from "../domain/types";
import type { FlashcardsSettings } from "../settings/settings";
import { studyDayKey } from "../utils/time";
import { buildQueue, dueOf, type DeckCounts, type StudyQueue } from "./queue";
import type { ScheduledAnswer, Scheduler } from "./Scheduler";
import { isLearning, noteKey } from "./studyDay";

/** Where a card came from, which decides how it's counted and re-queued. */
type QueueKind = "new" | "review" | "learning";

interface UndoStep {
	ref: CardRef;
	previous: CardProgress;
	siblings: { ref: CardRef; previous: CardProgress }[];
	queue: StudyQueue;
	shown: { new: number; review: number };
	logged: boolean;
}

export type SessionChange = (packageIds: ReadonlySet<string>) => void;

/**
 * One study session over a deck. Owns the queue, picks the next card, applies
 * answers (progress + review log), and supports undo, bury and suspend.
 */
export class ReviewSession {
	private queue: StudyQueue;
	private readonly undoStack: UndoStep[] = [];
	private shown = { new: 0, review: 0 };
	private initialTotals: { new: number; review: number };
	private currentRef: CardRef | null = null;
	private currentKind: QueueKind | null = null;
	/** Cards answered in this session, for the summary screen. */
	answered = 0;

	constructor(
		private readonly collection: Collection,
		private readonly scheduler: Scheduler,
		private readonly settings: FlashcardsSettings,
		readonly deckName: string | null,
		private readonly onChange: SessionChange,
		private readonly clock: () => number = Date.now,
	) {
		this.queue = buildQueue(collection, deckName, settings, clock());
		this.initialTotals = { new: this.queue.newCards.length, review: this.queue.reviewCards.length };
	}

	get current(): CardRef | null {
		return this.currentRef;
	}

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	counts(): DeckCounts {
		const cutoff = this.clock() + this.settings.learnAheadMinutes * 60_000;
		return {
			newCount: this.queue.newCards.length,
			learnCount: this.queue.learningCards.filter((ref) => dueOf(this.collection, ref) <= cutoff).length,
			reviewCount: this.queue.reviewCards.length,
		};
	}

	/** When the next learning card becomes available, if the session is waiting on one. */
	nextLearningDue(): number | null {
		const first = this.queue.learningCards[0];
		return first ? dueOf(this.collection, first) : null;
	}

	/** Moves to the next card, or returns null when nothing is due now. */
	next(): CardRef | null {
		const now = this.clock();
		const pick = this.pick(now);
		this.currentRef = pick?.ref ?? null;
		this.currentKind = pick?.kind ?? null;
		return this.currentRef;
	}

	preview(): Record<Grade, ScheduledAnswer> | null {
		const ref = this.currentRef;
		return ref ? this.scheduler.preview(this.collection.progress(ref).memory, this.clock()) : null;
	}

	answer(grade: Grade, durationMs: number): void {
		const ref = this.currentRef;
		const kind = this.currentKind;
		if (!ref || !kind) return;
		const now = this.clock();
		const previous = this.collection.progress(ref);
		const step = this.snapshot(ref, previous, true);

		const outcome = this.scheduler.answer(previous.memory, grade, now);
		this.collection.setProgress(ref, { ...previous, memory: outcome.memory });
		const entry: ReviewEntry = [now, ref.card.id, grade, previous.memory?.state ?? CardState.New, Math.round(durationMs)];
		ref.pkg.progress.log.push(entry);

		this.removeFromQueue(ref);
		if (kind === "new") this.shown.new++;
		if (kind === "review") this.shown.review++;
		this.answered++;

		const today = studyDayKey(now, this.settings.dayStartHour);
		if (isLearning({ memory: outcome.memory }) && studyDayKey(outcome.memory.due, this.settings.dayStartHour) <= today) {
			this.queue.learningCards.push(ref);
			this.queue.learningCards.sort((a, b) => dueOf(this.collection, a) - dueOf(this.collection, b));
		}
		this.burySiblings(ref, step, today);
		this.undoStack.push(step);
		this.currentRef = null;
		this.currentKind = null;
		this.notify([ref, ...step.siblings.map((s) => s.ref)]);
	}

	/** Hides the current card until tomorrow. */
	buryCurrent(): void {
		this.setAside((progress, today) => ({ ...progress, buriedOn: today }));
	}

	/** Takes the current card out of rotation until it's unsuspended in the browser. */
	suspendCurrent(): void {
		this.setAside((progress) => ({ ...progress, suspended: true }));
	}

	/** Reverts the last answer, bury or suspend, and makes that card current again. */
	undo(): CardRef | null {
		const step = this.undoStack.pop();
		if (!step) return null;
		this.collection.setProgress(step.ref, step.previous);
		for (const sibling of step.siblings) this.collection.setProgress(sibling.ref, sibling.previous);
		if (step.logged) {
			const log = step.ref.pkg.progress.log;
			for (let i = log.length - 1; i >= 0; i--) {
				if (log[i][1] === step.ref.card.id) {
					log.splice(i, 1);
					break;
				}
			}
			this.answered = Math.max(0, this.answered - 1);
		}
		this.queue = step.queue;
		this.shown = step.shown;
		this.currentRef = step.ref;
		this.currentKind = this.kindOf(step.previous);
		this.removeFromQueue(step.ref);
		this.notify([step.ref, ...step.siblings.map((s) => s.ref)]);
		return step.ref;
	}

	private setAside(update: (progress: CardProgress, today: string) => CardProgress): void {
		const ref = this.currentRef;
		if (!ref) return;
		const previous = this.collection.progress(ref);
		const step = this.snapshot(ref, previous, false);
		const today = studyDayKey(this.clock(), this.settings.dayStartHour);
		this.collection.setProgress(ref, update(previous, today));
		this.removeFromQueue(ref);
		this.undoStack.push(step);
		this.currentRef = null;
		this.currentKind = null;
		this.notify([ref]);
	}

	private pick(now: number): { ref: CardRef; kind: QueueKind } | null {
		const { learningCards, newCards, reviewCards } = this.queue;
		const firstLearning = learningCards[0];
		if (firstLearning && dueOf(this.collection, firstLearning) <= now) return { ref: firstLearning, kind: "learning" };

		const takeNew = this.shouldTakeNew();
		if (takeNew && newCards[0]) return { ref: newCards[0], kind: "new" };
		if (reviewCards[0]) return { ref: reviewCards[0], kind: "review" };
		if (newCards[0]) return { ref: newCards[0], kind: "new" };

		const learnAhead = now + this.settings.learnAheadMinutes * 60_000;
		if (firstLearning && dueOf(this.collection, firstLearning) <= learnAhead) return { ref: firstLearning, kind: "learning" };
		return null;
	}

	/** Spreads new cards evenly between reviews, or puts them first or last. */
	private shouldTakeNew(): boolean {
		const { newCards, reviewCards } = this.queue;
		if (newCards.length === 0) return false;
		if (reviewCards.length === 0) return true;
		switch (this.settings.newCardMix) {
			case "before-reviews":
				return true;
			case "after-reviews":
				return false;
			case "mixed": {
				const total = this.initialTotals.new + this.initialTotals.review;
				const shown = this.shown.new + this.shown.review;
				return total === 0 || this.shown.new / (shown + 1) < this.initialTotals.new / total;
			}
		}
	}

	private burySiblings(ref: CardRef, step: UndoStep, today: string): void {
		const { buryNewSiblings, buryReviewSiblings } = this.settings;
		if (!buryNewSiblings && !buryReviewSiblings) return;
		const key = noteKey(ref);
		const matches = (list: CardRef[]) => list.filter((other) => other.key !== ref.key && noteKey(other) === key);
		const toBury = [...(buryNewSiblings ? matches(this.queue.newCards) : []), ...(buryReviewSiblings ? matches(this.queue.reviewCards) : [])];
		for (const sibling of toBury) {
			const previous = this.collection.progress(sibling);
			step.siblings.push({ ref: sibling, previous });
			this.collection.setProgress(sibling, { ...previous, buriedOn: today });
			this.removeFromQueue(sibling);
		}
	}

	private snapshot(ref: CardRef, previous: CardProgress, logged: boolean): UndoStep {
		return {
			ref,
			previous: structuredClone(previous),
			siblings: [],
			queue: { newCards: [...this.queue.newCards], reviewCards: [...this.queue.reviewCards], learningCards: [...this.queue.learningCards] },
			shown: { ...this.shown },
			logged,
		};
	}

	private removeFromQueue(ref: CardRef): void {
		const keep = (other: CardRef) => other.key !== ref.key;
		this.queue.newCards = this.queue.newCards.filter(keep);
		this.queue.reviewCards = this.queue.reviewCards.filter(keep);
		this.queue.learningCards = this.queue.learningCards.filter(keep);
	}

	private kindOf(progress: CardProgress): QueueKind {
		if (!progress.memory) return "new";
		return isLearning(progress) ? "learning" : "review";
	}

	private notify(refs: CardRef[]): void {
		this.onChange(new Set(refs.map((ref) => ref.pkg.data.id)));
	}
}
