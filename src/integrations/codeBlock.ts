import type { FlashcardsApi } from "./api";
import { renderCounts } from "../ui/components/charts";
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

	const box = el.createDiv({ cls: "fc-block" });
	const head = box.createDiv({ cls: "fc-block-head" });
	head.createDiv({ cls: "fc-block-title", text: options.title ?? (deck ? deck.split("::").pop() : "All decks") ?? "Flashcards" });
	renderCounts(head, stats);

	const { cards } = stats;
	const learned = cards.young + cards.mature;
	const bar = box.createDiv({ cls: "fc-block-progress", attr: { "aria-label": `${learned} of ${cards.total} learned` } });
	const fill = bar.createDiv({ cls: "fc-block-progress-fill" });
	fill.style.width = `${cards.total === 0 ? 0 : Math.round((learned / cards.total) * 100)}%`;

	box.createDiv({
		cls: "fc-block-meta",
		text: `${learned}/${cards.total} learned · ${cards.mature} mature · ${pluralize(stats.reviewsToday, "review")} today · ${pluralize(stats.streak, "day")} streak`,
	});
	const due = stats.newCount + stats.learnCount + stats.reviewCount;
	const button = box.createEl("button", { cls: due > 0 ? "mod-cta" : "", text: due > 0 ? "Study now" : "Done for today" });
	button.addEventListener("click", () => api.study(deck));
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
