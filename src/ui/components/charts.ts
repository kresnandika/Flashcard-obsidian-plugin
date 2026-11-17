import { addDays, type DayKey } from "../../utils/time";
import { pluralize } from "../../utils/strings";
import type { Headword } from "./guideWords";

export interface Counts {
	newCount: number;
	learnCount: number;
	reviewCount: number;
}

/** A grid of reviews per day, one column per week, ending today. Ink density follows the count. */
export function renderHeatmap(parent: HTMLElement, perDay: Map<DayKey, number>, today: DayKey, weeks = 26): void {
	const wrap = parent.createDiv({ cls: "fc-heatmap", attr: { role: "img", "aria-label": `Reviews per day over the last ${weeks} weeks` } });
	const max = Math.max(1, ...perDay.values());
	const [y, m, d] = today.split("-").map(Number);
	const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
	const start = addDays(today, -(weeks - 1) * 7 - weekday);

	for (let week = 0; week < weeks; week++) {
		const column = wrap.createDiv({ cls: "fc-heatmap-week" });
		for (let day = 0; day < 7; day++) {
			const key = addDays(start, week * 7 + day);
			const cell = column.createDiv({ cls: "fc-heatmap-day" });
			if (key > today) {
				cell.addClass("is-future");
				continue;
			}
			const count = perDay.get(key) ?? 0;
			const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
			cell.addClass(`level-${level}`);
			if (key === today) cell.addClass("is-today");
			cell.setAttribute("title", `${key}: ${pluralize(count, "review")}`);
		}
	}
}

/** Review cards due on each of the next days, as a row of thin bars with their counts. */
export function renderForecast(parent: HTMLElement, counts: number[]): void {
	const wrap = parent.createDiv({ cls: "fc-forecast" });
	const max = Math.max(1, ...counts);
	const labels = ["Today", "Tmrw"];
	counts.forEach((count, index) => {
		const column = wrap.createDiv({ cls: "fc-forecast-day", attr: { title: `${labels[index] ?? `In ${index} days`}: ${pluralize(count, "review")}` } });
		column.createDiv({ cls: "fc-forecast-count", text: count > 0 ? String(count) : "·" });
		const track = column.createDiv({ cls: "fc-forecast-track" });
		const bar = track.createDiv({ cls: "fc-forecast-bar" });
		bar.style.height = count === 0 ? "0" : `${Math.max(6, Math.round((count / max) * 100))}%`;
		column.createDiv({ cls: "fc-forecast-label", text: labels[index] ?? `+${index}` });
	});
}

/** New / learning / due counts. Each has its own pigment and zeros recede, so state reads without colour too. */
export function renderCounts(parent: HTMLElement, counts: Counts): HTMLElement {
	const wrap = parent.createSpan({ cls: "fc-counts" });
	const add = (kind: string, value: number, label: string) =>
		wrap.createSpan({ cls: `fc-count fc-count-${kind}${value === 0 ? " is-zero" : ""}`, text: String(value), attr: { "aria-label": `${value} ${label}` } });
	add("new", counts.newCount, "new");
	add("learn", counts.learnCount, "learning");
	add("review", counts.reviewCount, "to review");
	return wrap;
}

/** The counts as a sentence: "20 new · 3 learning · 12 to review". */
export function renderCountSentence(parent: HTMLElement, counts: Counts): void {
	const line = parent.createDiv({ cls: "fc-count-line" });
	const parts: [string, number, string][] = [
		["new", counts.newCount, "new"],
		["learn", counts.learnCount, "learning"],
		["review", counts.reviewCount, "to review"],
	];
	parts.forEach(([kind, value, label], index) => {
		if (index > 0) line.createSpan({ cls: "fc-sep", text: " · " });
		const part = line.createSpan({ cls: `fc-count-part fc-count-${kind}${value === 0 ? " is-zero" : ""}` });
		part.createSpan({ cls: "fc-count-value", text: String(value) });
		part.appendText(` ${label}`);
	});
}

/** A dictionary running head: "爱 ài — 八 bā". */
export function renderGuideWords(parent: HTMLElement, first: Headword, last: Headword): void {
	const wrap = parent.createDiv({ cls: "fc-guide-words" });
	const word = (headword: Headword) => {
		const el = wrap.createSpan({ cls: "fc-headword" });
		el.createSpan({ cls: "fc-headword-text", text: headword.text });
		if (headword.reading) el.createSpan({ cls: "fc-headword-reading", text: headword.reading });
	};
	word(first);
	if (first.text !== last.text) {
		wrap.createSpan({ cls: "fc-guide-dash", text: "—" });
		word(last);
	}
}
