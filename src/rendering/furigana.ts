/** `漢字[かんじ]` readings, optionally preceded by a space that marks where the base text starts. */
const READING_PATTERN = / ?([^ >[\]]+?)\[(.+?)\]/g;

export function furigana(text: string): string {
	return text.replace(READING_PATTERN, (_m, base: string, reading: string) => `<ruby><rb>${base}</rb><rt>${reading}</rt></ruby>`);
}

export function kanaOnly(text: string): string {
	return text.replace(READING_PATTERN, (_m, _base: string, reading: string) => reading);
}

export function kanjiOnly(text: string): string {
	return text.replace(READING_PATTERN, (_m, base: string) => base);
}
