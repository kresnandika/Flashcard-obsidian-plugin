import { escapeHtml, stripHtml } from "../utils/strings";

/** `{{c1::answer}}` or `{{c1::answer::hint}}`. Nested clozes aren't supported. */
const CLOZE_PATTERN = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

export type Side = "front" | "back";

/** Renders cloze deletions for card number `ordinal` (1-based), matching Anki's markup. */
export function renderCloze(text: string, ordinal: number, side: Side): string {
	return text.replace(CLOZE_PATTERN, (_match, number: string, answer: string, hint: string | undefined) => {
		const n = Number(number);
		if (n !== ordinal) return `<span class="cloze-inactive" data-ordinal="${n}">${answer}</span>`;
		if (side === "back") return `<span class="cloze" data-ordinal="${n}">${answer}</span>`;
		return `<span class="cloze" data-cloze="${escapeHtml(answer)}" data-ordinal="${n}">[${hint ?? "..."}]</span>`;
	});
}

/** Only the answers of cloze `ordinal`, joined with commas (the `cloze-only` filter and type-in clozes). */
export function clozeAnswers(text: string, ordinal: number): string {
	const answers: string[] = [];
	for (const match of text.matchAll(CLOZE_PATTERN)) {
		if (Number(match[1]) === ordinal) answers.push(match[2]);
	}
	return answers.join(", ");
}

/** The cloze numbers used in a field, sorted. */
export function clozeNumbers(text: string): number[] {
	const numbers = new Set<number>();
	for (const match of text.matchAll(CLOZE_PATTERN)) numbers.add(Number(match[1]));
	return [...numbers].sort((a, b) => a - b);
}

export function hasCloze(text: string, ordinal: number): boolean {
	return clozeNumbers(text).includes(ordinal);
}

export function plainClozeAnswer(text: string, ordinal: number): string {
	return stripHtml(clozeAnswers(text, ordinal));
}
