import type { CardRef } from "../../domain/types";
import type { StudyQueue } from "../../scheduling/queue";
import { stripHtml } from "../../utils/strings";

/** A dictionary-style headword: the card's main text plus an optional short reading (e.g. pinyin). */
export interface Headword {
	text: string;
	reading: string | null;
}

const MAX_HEADWORD = 14;
const MAX_READING = 18;

export function headword(ref: CardRef): Headword {
	const fields = ref.note.fields.map((field) => stripHtml(field.replace(/\[sound:[^\]]+\]/g, "")));
	const main = fields[ref.noteType.sortField] ?? fields[0] ?? "";
	const reading = fields.find((field, index) => index !== ref.noteType.sortField && field.length > 0) ?? "";
	return {
		text: truncate(main || "—", MAX_HEADWORD),
		reading: reading && reading.length <= MAX_READING ? reading : null,
	};
}

/** The cards in the order a session meets them, roughly: learning, reviews, then new. */
export function queueOrder(queue: StudyQueue): CardRef[] {
	return [...queue.learningCards, ...queue.reviewCards, ...queue.newCards];
}

/** First and last headword of today's queue, like the guide words at the top of a dictionary page. */
export function guideWords(queue: StudyQueue): { first: Headword; last: Headword } | null {
	const cards = queueOrder(queue);
	if (cards.length === 0) return null;
	return { first: headword(cards[0]), last: headword(cards[cards.length - 1]) };
}

function truncate(text: string, max: number): string {
	const chars = [...text];
	return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}
