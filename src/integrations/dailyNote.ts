import { normalizePath, TFile, type App } from "obsidian";
import type { FlashcardsSettings } from "../settings/settings";
import { studyDayKey } from "../utils/time";

/** Resolves the configured daily note path for a study day; `{{date}}` becomes YYYY-MM-DD. */
export function dailyNotePath(template: string, day: string): string {
	return normalizePath(template.replace(/\{\{\s*date\s*\}\}/g, day));
}

/**
 * Sets a frontmatter property (e.g. a habit checkbox) to true on the daily
 * note when a study session is finished. Does nothing if the note is missing.
 */
export async function markDailyNote(app: App, settings: FlashcardsSettings, now = Date.now()): Promise<boolean> {
	const { enabled, path, property } = settings.dailyNote;
	if (!enabled || !path.trim() || !property.trim()) return false;
	const file = app.vault.getAbstractFileByPath(dailyNotePath(path, studyDayKey(now, settings.dayStartHour)));
	if (!(file instanceof TFile)) return false;
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		frontmatter[property.trim()] = true;
	});
	return true;
}
