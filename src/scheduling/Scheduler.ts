import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type FSRS, type Grade as FsrsGrade, type StepUnit } from "ts-fsrs";
import type { CardState} from "../domain/types";
import { GRADES, type Grade, type MemoryState } from "../domain/types";
import type { SchedulerSettings } from "../settings/settings";

export interface ScheduledAnswer {
	grade: Grade;
	memory: MemoryState;
	/** Time until the card is due again. */
	intervalMs: number;
}

/**
 * Thin adapter around ts-fsrs. Everything else in the plugin works with the
 * plain, JSON-friendly MemoryState, so the library can be swapped or upgraded
 * by changing only this file.
 */
export class Scheduler {
	private readonly engine: FSRS;

	constructor(settings: SchedulerSettings) {
		this.engine = fsrs(
			generatorParameters({
				request_retention: settings.desiredRetention,
				maximum_interval: settings.maximumIntervalDays,
				enable_fuzz: settings.enableFuzz,
				enable_short_term: true,
				learning_steps: settings.learningSteps as StepUnit[],
				relearning_steps: settings.relearningSteps as StepUnit[],
				...(settings.weights.length > 0 ? { w: settings.weights } : {}),
			}),
		);
	}

	/** The outcome of each answer button, for showing intervals before answering. */
	preview(memory: MemoryState | undefined, now: number): Record<Grade, ScheduledAnswer> {
		const card = memory ? toFsrs(memory) : createEmptyCard(new Date(now));
		const outcomes = this.engine.repeat(card, new Date(now));
		const result = {} as Record<Grade, ScheduledAnswer>;
		for (const grade of GRADES) {
			const next = outcomes[grade as unknown as FsrsGrade].card;
			result[grade] = { grade, memory: fromFsrs(next), intervalMs: Math.max(0, next.due.getTime() - now) };
		}
		return result;
	}

	answer(memory: MemoryState | undefined, grade: Grade, now: number): ScheduledAnswer {
		return this.preview(memory, now)[grade];
	}

	/** Probability (0–1) that the card is still remembered at `now`. */
	retrievability(memory: MemoryState, now: number): number {
		return this.engine.get_retrievability(toFsrs(memory), new Date(now), false);
	}
}

export function toFsrs(memory: MemoryState): FsrsCard {
	return {
		due: new Date(memory.due),
		stability: memory.stability,
		difficulty: memory.difficulty,
		elapsed_days: memory.elapsedDays,
		scheduled_days: memory.scheduledDays,
		learning_steps: memory.learningSteps,
		reps: memory.reps,
		lapses: memory.lapses,
		state: memory.state as number,
		last_review: memory.lastReview === undefined ? undefined : new Date(memory.lastReview),
	};
}

export function fromFsrs(card: FsrsCard): MemoryState {
	const memory: MemoryState = {
		due: card.due.getTime(),
		stability: round(card.stability),
		difficulty: round(card.difficulty),
		elapsedDays: card.elapsed_days,
		scheduledDays: card.scheduled_days,
		learningSteps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state as number as CardState,
	};
	if (card.last_review) memory.lastReview = card.last_review.getTime();
	return memory;
}

function round(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}
