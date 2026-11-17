import type { FlashcardsApi } from "./api";
import { renderCountSentence } from "../ui/components/charts";
import { pluralize } from "../utils/strings";

/**
 * Renders a `flashcards` code block in notes:
 *
 * ```flashcards
 * deck: HSK 1 (300 Words)
 * ```
 *
 * shows today's counts, card states and a Study button. Without `deck`, it
 * covers every deck.
 */
export function renderCodeBlock(source: string, el: HTMLElement, api: FlashcardsApi): void {
	const options = parseOptions(source);
	const deck = options.deck ?? null;
	const stats = api.stats(deck);
	const due = stats.newCount + stats.learnCount + stats.reviewCount;
	const { cards } = stats;
	const learned = cards.young + cards.mature;

	const box = el.createDiv({ cls: "fc-block" });
	const head = box.createDiv({ cls: "fc-block-head" });
	head.createDiv({ cls: "fc-block-title", text: options.title ?? (deck ? deck.split("::").pop() : "All decks") ?? "Flashcards" });
	head.createDiv({ cls: "fc-block-scope", text: `${learned} of ${cards.total} learned` });

	const body = box.createDiv({ cls: "fc-block-body" });
	const figure = body.createDiv({ cls: "fc-today-figure" });
	figure.createDiv({ cls: "fc-today-number", text: String(due) });
	const text = figure.createDiv({ cls: "fc-today-text" });
	text.createDiv({ cls: "fc-today-label", text: due === 1 ? "card due today" : "cards due today" });
	renderCountSentence(text, stats);

	const button = body.createEl("button", { cls: due > 0 ? "mod-cta" : "", text: due > 0 ? "Study now" : "Done for today" });
	button.addEventListener("click", () => api.study(deck));

	const bar = box.createDiv({ cls: "fc-block-progress", attr: { role: "progressbar", "aria-label": `${learned} of ${cards.total} learned` } });
	bar.createDiv({ cls: "fc-block-progress-fill" }).style.width = `${cards.total === 0 ? 0 : Math.round((learned / cards.total) * 100)}%`;

	const facts = [`${pluralize(stats.reviewsToday, "review")} today`];
	if (stats.streak > 0) facts.push(`${stats.streak}-day streak`);
	if (cards.mature > 0) facts.push(`${cards.mature} mature`);
	box.createDiv({ cls: "fc-block-meta", text: facts.join(" · ") });
}

export function parseOptions(source: string): Record<string, string> {
	const options: Record<string, string> = {};
	for (const line of source.split("\n")) {
		const index = line.indexOf(":");
		if (index < 0) continue;
		const key = line.slice(0, index).trim().toLowerCase();
		const value = line.slice(index + 1).trim();
		if (key && value) options[key] = value;
	}
	return options;
}
