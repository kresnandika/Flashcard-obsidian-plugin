import type { CardRef } from "../domain/types";
import { extractSounds } from "./media";
import { renderTemplate, type TemplateContext } from "./templateEngine";

export interface RenderedSide {
	html: string;
	/** Media file names of `[sound:]` tags, in order of appearance. */
	sounds: string[];
	/** Sounds to play automatically when the side is shown. */
	autoplay: string[];
}

function baseContext(ref: CardRef): Omit<TemplateContext, "side"> {
	const fields: Record<string, string> = {};
	ref.noteType.fields.forEach((name, index) => (fields[name] = ref.note.fields[index] ?? ""));
	return {
		fields,
		tags: ref.note.tags,
		deckName: ref.deckName,
		noteTypeName: ref.noteType.name,
		cardName: ref.template.name,
		clozeOrdinal: ref.noteType.kind === "cloze" ? ref.card.ord + 1 : undefined,
	};
}

export function renderFront(ref: CardRef): RenderedSide {
	const html = renderTemplate(ref.template.front, { ...baseContext(ref), side: "front" });
	const { html: withButtons, sounds } = extractSounds(html);
	return { html: withButtons, sounds, autoplay: sounds };
}

/**
 * Renders the back. When the back template includes `{{FrontSide}}`, the
 * front's sounds aren't autoplayed again, matching Anki.
 */
export function renderBack(ref: CardRef, typedAnswer = ""): RenderedSide {
	const context = baseContext(ref);
	const frontRaw = renderTemplate(ref.template.front, { ...context, side: "front" });
	const frontSounds = extractSounds(frontRaw).sounds.length;
	const html = renderTemplate(ref.template.back, { ...context, side: "back", frontSide: frontRaw, typedAnswer });
	const { html: withButtons, sounds } = extractSounds(html);
	const includesFront = /\{\{\s*FrontSide\s*\}\}/.test(ref.template.back);
	return { html: withButtons, sounds, autoplay: includesFront ? sounds.slice(frontSounds) : sounds };
}

/** True when a side renders to nothing visible, which Anki calls an empty card. */
export function isBlank(side: RenderedSide): boolean {
	return side.sounds.length === 0 && !/<img|<video|<audio|<canvas|<input|<textarea/i.test(side.html) && side.html.replace(/<[^>]+>/g, "").trim() === "";
}
