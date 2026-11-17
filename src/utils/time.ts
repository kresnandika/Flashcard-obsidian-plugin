export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** A calendar day in local time, formatted `YYYY-MM-DD`. Sorts lexicographically. */
export type DayKey = string;

function pad(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

export function formatDayKey(date: Date): DayKey {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Like Anki, a study day starts at `dayStartHour` (default 4 am) rather than at
 * midnight, so a late-night session still counts towards the previous day.
 */
export function studyDayKey(time: number | Date, dayStartHour: number): DayKey {
	const ms = typeof time === "number" ? time : time.getTime();
	return formatDayKey(new Date(ms - dayStartHour * HOUR_MS));
}

/** Shifts a day key by whole days. */
export function addDays(day: DayKey, days: number): DayKey {
	const [y, m, d] = day.split("-").map(Number);
	return formatDayKey(new Date(y, m - 1, d + days));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DayKey, to: DayKey): number {
	const [y1, m1, d1] = from.split("-").map(Number);
	const [y2, m2, d2] = to.split("-").map(Number);
	return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** Short human interval used on the answer buttons: `<1m`, `10m`, `3h`, `4d`, `2.1mo`, `1.5y`. */
export function formatInterval(ms: number): string {
	if (ms < MINUTE_MS) return "<1m";
	if (ms < HOUR_MS) return `${Math.round(ms / MINUTE_MS)}m`;
	if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`;
	const days = ms / DAY_MS;
	if (days < 30) return `${Math.round(days)}d`;
	if (days < 365) return `${trimNumber(days / 30)}mo`;
	return `${trimNumber(days / 365)}y`;
}

function trimNumber(value: number): string {
	return value.toFixed(1).replace(/\.0$/, "");
}
