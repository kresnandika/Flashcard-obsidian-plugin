import { CardState, type CardProgress, type CardRef, type LoadedPackage, type ReviewEntry } from "../domain/types";
import { studyDayKey, type DayKey } from "../utils/time";

/** What has already been studied today, per card and per note. Built from the review logs. */
export interface TodayActivity {
	day: DayKey;
	/** Card keys of new cards introduced today. */
	introduced: Set<string>;
	/** Card keys of review cards answered today. */
	reviewed: Set<string>;
	/** `packageId/noteId` of every note with any card answered today. */
	notesTouched: Set<string>;
}

export function noteKey(ref: CardRef): string {
	return `${ref.pkg.data.id}/${ref.note.id}`;
}

export function todayActivity(packages: Iterable<LoadedPackage>, now: number, dayStartHour: number): TodayActivity {
	const day = studyDayKey(now, dayStartHour);
	const activity: TodayActivity = { day, introduced: new Set(), reviewed: new Set(), notesTouched: new Set() };
	for (const pkg of packages) {
		const { log } = pkg.progress;
		// Logs are append-only and chronological, so walk back until yesterday.
		for (let i = log.length - 1; i >= 0; i--) {
			const entry: ReviewEntry = log[i];
			if (studyDayKey(entry[0], dayStartHour) !== day) break;
			const key = `${pkg.data.id}/${entry[1]}`;
			if (entry[3] === CardState.New) activity.introduced.add(key);
			if (entry[3] === CardState.Review) activity.reviewed.add(key);
			const card = pkg.data.cards[entry[1]];
			if (card) activity.notesTouched.add(`${pkg.data.id}/${card.noteId}`);
		}
	}
	return activity;
}

/** Whether a card is out of rotation today (suspended or buried). */
export function isInactive(progress: CardProgress, today: DayKey): boolean {
	return Boolean(progress.suspended) || progress.buriedOn === today;
}

export function isLearning(progress: CardProgress): boolean {
	const state = progress.memory?.state;
	return state === CardState.Learning || state === CardState.Relearning;
}

export function isReviewDue(progress: CardProgress, today: DayKey, dayStartHour: number): boolean {
	const memory = progress.memory;
	return memory?.state === CardState.Review && studyDayKey(memory.due, dayStartHour) <= today;
}
