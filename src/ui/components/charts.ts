import { addDays, type DayKey } from "../../utils/time";
import { pluralize } from "../../utils/strings";

/** A GitHub-style grid of reviews per day: one column per week, ending today. */
export function renderHeatmap(parent: HTMLElement, perDay: Map<DayKey, number>, today: DayKey, weeks = 26): void {
	const wrap = parent.createDiv({ cls: "fc-heatmap" });
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
			cell.setAttribute("aria-label", `${key}: ${pluralize(count, "review")}`);
		}
	}
}

/** Small bar chart of review cards due per day. */
export function renderForecast(parent: HTMLElement, counts: number[]): void {
	const wrap = parent.createDiv({ cls: "fc-forecast" });
	const max = Math.max(1, ...counts);
	const labels = ["Today", "Tmrw"];
	counts.forEach((count, index) => {
		const column = wrap.createDiv({ cls: "fc-forecast-day" });
		column.createDiv({ cls: "fc-forecast-count", text: count > 0 ? String(count) : "" });
		const bar = column.createDiv({ cls: "fc-forecast-bar" });
		bar.style.height = `${Math.round((count / max) * 100)}%`;
		column.createDiv({ cls: "fc-forecast-label", text: labels[index] ?? `+${index}` });
	});
}

/** The new / learning / due numbers, coloured like Anki's. */
export function renderCounts(parent: HTMLElement, counts: { newCount: number; learnCount: number; reviewCount: number }): void {
	const wrap = parent.createSpan({ cls: "fc-counts" });
	const add = (kind: string, value: number, label: string) =>
		wrap.createSpan({ cls: `fc-count fc-count-${kind}${value === 0 ? " is-zero" : ""}`, text: String(value), attr: { "aria-label": label } });
	add("new", counts.newCount, "New");
	add("learn", counts.learnCount, "Learning");
	add("review", counts.reviewCount, "Due");
}

export function renderStat(parent: HTMLElement, label: string, value: string, hint?: string): void {
	const stat = parent.createDiv({ cls: "fc-stat" });
	stat.createDiv({ cls: "fc-stat-value", text: value });
	stat.createDiv({ cls: "fc-stat-label", text: label });
	if (hint) stat.setAttribute("aria-label", hint);
}
