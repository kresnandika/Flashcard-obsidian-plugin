/** Removes HTML tags and decodes the few entities Anki fields commonly contain. */
export function stripHtml(html: string): string {
	return decodeEntities(
		html
			.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
			.replace(/<br\s*\/?>/gi, " ")
			.replace(/<[^>]+>/g, ""),
	).trim();
}

const ENTITIES: Record<string, string> = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
};

export function decodeEntities(text: string): string {
	return text
		.replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (entity) => ENTITIES[entity] ?? entity)
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Turns a deck or package name into a folder-safe slug, keeping non-Latin letters. */
export function slugify(name: string): string {
	const slug = name
		.normalize("NFKC")
		.replace(/[\\/:*?"<>|#^[\]]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
	return slug || "deck";
}

export function pluralize(count: number, word: string, plural = `${word}s`): string {
	return `${count} ${count === 1 ? word : plural}`;
}
