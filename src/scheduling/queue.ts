import type { Collection } from "../domain/Collection";
import type { CardRef } from "../domain/types";
import { limitsFor, type FlashcardsSettings } from "../settings/settings";
import { studyDayKey } from "../utils/time";
import { isInactive, isLearning, isReviewDue, noteKey, todayActivity } from "./studyDay";

export interface StudyQueue {
	newCards: CardRef[];
	reviewCards: CardRef[];
	/** Learning and relearning cards due before the end of the study day, earliest first. */
	learningCards: CardRef[];
}

export interface DeckCounts {
	newCount: number;
	learnCount: number;
	reviewCount: number;
}

/**
 * Picks the cards to study in a deck (and its sub-decks) right now, applying
 * the daily limits, sibling burying and the new-card gather order.
 */
export function buildQueue(collection: Collection, deckName: string | null, settings: FlashcardsSettings, now: number): StudyQueue {
	const { dayStartHour } = settings;
	const today = studyDayKey(now, dayStartHour);
	const activity = todayActivity(collection.allPackages(), now, dayStartHour);
	const cards = collection.cardsInDeck(deckName);
	const limits = limitsFor(settings, deckName);

	const keys = new Set(cards.map((ref) => ref.key));
	const introducedToday = [...activity.introduced].filter((key) => keys.has(key)).length;
	const reviewedToday = [...activity.reviewed].filter((key) => keys.has(key)).length;

	const learningCards: CardRef[] = [];
	const reviewCandidates: CardRef[] = [];
	const newCandidates: CardRef[] = [];

	for (const ref of cards) {
		const progress = collection.progress(ref);
		if (isInactive(progress, today)) continue;
		if (!progress.memory) newCandidates.push(ref);
		else if (isLearning(progress)) {
			if (studyDayKey(progress.memory.due, dayStartHour) <= today) learningCards.push(ref);
		} else if (isReviewDue(progress, today, dayStartHour)) reviewCandidates.push(ref);
	}

	learningCards.sort((a, b) => dueOf(collection, a) - dueOf(collection, b));

	reviewCandidates.sort((a, b) => dueOf(collection, a) - dueOf(collection, b));
	const reviewCards = takeLimited(reviewCandidates, Math.max(0, limits.reviewsPerDay - reviewedToday), settings.buryReviewSiblings ? new Set(activity.notesTouched) : null);

	const busyNotes = settings.buryNewSiblings ? new Set([...activity.notesTouched, ...reviewCards.map(noteKey), ...learningCards.map(noteKey)]) : null;
	newCandidates.sort(newCardComparator(settings));
	const newCards = takeLimited(newCandidates, Math.max(0, limits.newPerDay - introducedToday), busyNotes);

	return { newCards, reviewCards, learningCards };
}

/** Counts shown in the deck list. Learning cards count only once they're due (or within learn-ahead). */
export function deckCounts(collection: Collection, deckName: string | null, settings: FlashcardsSettings, now: number): DeckCounts {
	const queue = buildQueue(collection, deckName, settings, now);
	const cutoff = now + settings.learnAheadMinutes * 60_000;
	return {
		newCount: queue.newCards.length,
		learnCount: queue.learningCards.filter((ref) => dueOf(collection, ref) <= cutoff).length,
		reviewCount: queue.reviewCards.length,
	};
}

export function dueOf(collection: Collection, ref: CardRef): number {
	return collection.progress(ref).memory?.due ?? 0;
}

/** Takes up to `limit` cards; with `busyNotes`, at most one card per note and none from busy notes. */
function takeLimited(sorted: CardRef[], limit: number, busyNotes: Set<string> | null): CardRef[] {
	const picked: CardRef[] = [];
	for (const ref of sorted) {
		if (picked.length >= limit) break;
		if (busyNotes) {
			const key = noteKey(ref);
			if (busyNotes.has(key)) continue;
			busyNotes.add(key);
		}
		picked.push(ref);
	}
	return picked;
}

function newCardComparator(settings: FlashcardsSettings): (a: CardRef, b: CardRef) => number {
	const byPosition = (a: CardRef, b: CardRef) => a.card.position - b.card.position || a.card.ord - b.card.ord;
	const byDeck = (a: CardRef, b: CardRef) => a.deckName.localeCompare(b.deckName, undefined, { numeric: true });
	return settings.newCardGather === "deck" ? (a, b) => byDeck(a, b) || byPosition(a, b) : (a, b) => byPosition(a, b) || byDeck(a, b);
}
