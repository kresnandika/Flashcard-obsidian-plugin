import type { Collection } from "../domain/Collection";
import { CardState, Grade, type LoadedPackage, type ReviewEntry } from "../domain/types";
import { addDays, daysBetween, studyDayKey, type DayKey } from "../utils/time";

/** Cards whose interval reached this many days count as mature, as in Anki. */
export const MATURE_INTERVAL_DAYS = 21;

export interface CardBreakdown {
	total: number;
	new: number;
	learning: number;
	young: number;
	mature: number;
	suspended: number;
}

export interface ReviewSummary {
	reviewsToday: number;
	minutesToday: number;
	/** Consecutive study days with at least one review, ending today (or yesterday if not yet today). */
	streak: number;
	/** Share of review-state answers that weren't "Again", over the last 30 days. */
	retention30d: number | null;
	/** Reviews per study day. */
	perDay: Map<DayKey, number>;
}

export function cardBreakdown(collection: Collection, deckName: string | null): CardBreakdown {
	const result: CardBreakdown = { total: 0, new: 0, learning: 0, young: 0, mature: 0, suspended: 0 };
	for (const ref of collection.cardsInDeck(deckName)) {
		result.total++;
		const { memory, suspended } = collection.progress(ref);
		if (suspended) result.suspended++;
		else if (!memory) result.new++;
		else if (memory.state === CardState.Learning || memory.state === CardState.Relearning) result.learning++;
		else if (memory.scheduledDays >= MATURE_INTERVAL_DAYS) result.mature++;
		else result.young++;
	}
	return result;
}

/** Review log entries of the given packages, limited to cards in `deckName` when set. */
export function reviewEntries(collection: Collection, deckName: string | null): ReviewEntry[] {
	const packages: LoadedPackage[] = collection.allPackages();
	if (deckName === null) return packages.flatMap((pkg) => pkg.progress.log);
	const allowed = new Set(collection.cardsInDeck(deckName).map((ref) => ref.key));
	return packages.flatMap((pkg) => pkg.progress.log.filter((entry) => allowed.has(`${pkg.data.id}/${entry[1]}`)));
}

export function reviewSummary(entries: ReviewEntry[], now: number, dayStartHour: number): ReviewSummary {
	const today = studyDayKey(now, dayStartHour);
	const perDay = new Map<DayKey, number>();
	let reviewsToday = 0;
	let msToday = 0;
	let reviewAnswers = 0;
	let recalled = 0;
	const since = now - 30 * 86_400_000;

	for (const [time, , grade, stateBefore, duration] of entries) {
		const day = studyDayKey(time, dayStartHour);
		perDay.set(day, (perDay.get(day) ?? 0) + 1);
		if (day === today) {
			reviewsToday++;
			msToday += duration;
		}
		if (time >= since && stateBefore === CardState.Review) {
			reviewAnswers++;
			if (grade !== Grade.Again) recalled++;
		}
	}

	let streak = 0;
	let day = perDay.has(today) ? today : addDays(today, -1);
	while (perDay.has(day)) {
		streak++;
		day = addDays(day, -1);
	}

	return {
		reviewsToday,
		minutesToday: Math.round(msToday / 60_000),
		streak,
		retention30d: reviewAnswers === 0 ? null : recalled / reviewAnswers,
		perDay,
	};
}

/** Number of review cards due on each of the next `days` study days (today first, overdue included). */
export function dueForecast(collection: Collection, deckName: string | null, now: number, dayStartHour: number, days: number): number[] {
	const today = studyDayKey(now, dayStartHour);
	const lastDay = addDays(today, days - 1);
	const counts = new Array<number>(days).fill(0);
	for (const ref of collection.cardsInDeck(deckName)) {
		const { memory, suspended } = collection.progress(ref);
		if (!memory || suspended) continue;
		const due = studyDayKey(memory.due, dayStartHour);
		if (due > lastDay) continue;
		const offset = due <= today ? 0 : daysBetween(today, due);
		counts[offset]++;
	}
	return counts;
}
