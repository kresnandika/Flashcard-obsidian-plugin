import type { Collection } from "../domain/Collection";
import { resolveDeckName } from "../domain/deckTree";
import { deckCounts, type DeckCounts } from "../scheduling/queue";
import type { FlashcardsSettings } from "../settings/settings";
import { cardBreakdown, reviewEntries, reviewSummary, type CardBreakdown } from "../stats/statistics";

export interface DeckStats extends DeckCounts {
	cards: CardBreakdown;
	reviewsToday: number;
	minutesToday: number;
	streak: number;
	retention30d: number | null;
}

/**
 * Read-only API for other plugins and Dataview scripts:
 *
 *   const api = app.plugins.plugins["flashcard-srs"].api;
 *   api.stats("HSK 1");   // counts, card states, streak…
 *   api.study("HSK 1");   // opens a review session
 */
export interface FlashcardsApi {
	decks(): string[];
	counts(deckName?: string | null): DeckCounts;
	stats(deckName?: string | null): DeckStats;
	study(deckName?: string | null): void;
}

export function createApi(collection: () => Collection, settings: () => FlashcardsSettings, study: (deckName: string | null) => void): FlashcardsApi {
	const resolveDeck = (deckName?: string | null): string | null => (deckName ? resolveDeckName(collection().deckNames(), deckName) : null);

	return {
		decks: () => collection().deckNames().sort(),
		counts: (deckName) => deckCounts(collection(), resolveDeck(deckName), settings(), Date.now()),
		stats: (deckName) => {
			const deck = resolveDeck(deckName);
			const now = Date.now();
			const summary = reviewSummary(reviewEntries(collection(), deck), now, settings().dayStartHour);
			return {
				...deckCounts(collection(), deck, settings(), now),
				cards: cardBreakdown(collection(), deck),
				reviewsToday: summary.reviewsToday,
				minutesToday: summary.minutesToday,
				streak: summary.streak,
				retention30d: summary.retention30d,
			};
		},
		study: (deckName) => study(resolveDeck(deckName)),
	};
}
