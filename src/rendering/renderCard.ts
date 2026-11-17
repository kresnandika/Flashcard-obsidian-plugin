import type { CardRef } from "../domain/types";
import type { CardStyle, NoteTypeLayout } from "../settings/settings";
import { BUILTIN_CARD_CSS, renderBuiltinSide } from "./layout/builtinLayout";
import { detectCardKind } from "./layout/cardKind";
import { canUseBuiltinLayout, detectRoles, resolveRoles, type RoleMap } from "./layout/fieldRoles";
import { extractSounds } from "./media";
import { renderTemplate, type TemplateContext } from "./templateEngine";

export interface RenderedSide {
	html: string;
	/** Styles for the card document: the built-in layout's, or the note type's own. */
	css: string;
	/** True when the plugin's own layout drew the card. */
	builtin: boolean;
	/** Media file names of `[sound:]` tags, in order of appearance. */
	sounds: string[];
	/** Sounds to play automatically when the side is shown. */
	autoplay: string[];
}

export interface RenderOptions {
	cardStyle: CardStyle;
	noteTypeLayouts: Record<string, NoteTypeLayout>;
}

/** Deck templates only, as Anki would render them. */
export const DECK_DESIGN: RenderOptions = { cardStyle: "deck", noteTypeLayouts: {} };

/** The field roles the built-in layout uses for a card's note type, after the user's corrections. */
export function rolesFor(ref: CardRef, options: RenderOptions): RoleMap {
	return resolveRoles(detectRoles(ref.noteType, ref.note.fields), options.noteTypeLayouts[ref.noteType.id]?.roles);
}

/** Whether a card is drawn with the built-in layout under these options. */
export function usesBuiltinLayout(ref: CardRef, options: RenderOptions): boolean {
	const style = options.noteTypeLayouts[ref.noteType.id]?.style ?? options.cardStyle;
	return style === "flashcards" && canUseBuiltinLayout(rolesFor(ref, options));
}

export function renderFront(ref: CardRef, options: RenderOptions = DECK_DESIGN): RenderedSide {
	if (usesBuiltinLayout(ref, options)) {
		const roles = rolesFor(ref, options);
		const html = renderBuiltinSide(ref, roles, detectCardKind(ref.noteType, ref.template, roles), "front");
		return builtinSide(html);
	}
	const html = renderTemplate(ref.template.front, { ...baseContext(ref), side: "front" });
	const { html: withButtons, sounds } = extractSounds(html);
	return { html: withButtons, css: ref.noteType.css, builtin: false, sounds, autoplay: sounds };
}

/**
 * Renders the back. With deck templates, sounds that came from
 * `{{FrontSide}}` aren't autoplayed again, matching Anki.
 */
export function renderBack(ref: CardRef, typedAnswer = "", options: RenderOptions = DECK_DESIGN): RenderedSide {
	if (usesBuiltinLayout(ref, options)) {
		const roles = rolesFor(ref, options);
		const html = renderBuiltinSide(ref, roles, detectCardKind(ref.noteType, ref.template, roles), "back", typedAnswer);
		return builtinSide(html);
	}
	const context = baseContext(ref);
	const frontRaw = renderTemplate(ref.template.front, { ...context, side: "front" });
	const frontSounds = extractSounds(frontRaw).sounds.length;
	const html = renderTemplate(ref.template.back, { ...context, side: "back", frontSide: frontRaw, typedAnswer });
	const { html: withButtons, sounds } = extractSounds(html);
	const includesFront = /\{\{\s*FrontSide\s*\}\}/.test(ref.template.back);
	return { html: withButtons, css: ref.noteType.css, builtin: false, sounds, autoplay: includesFront ? sounds.slice(frontSounds) : sounds };
}

/** True when a side renders to nothing visible, which Anki calls an empty card. */
export function isBlank(side: RenderedSide): boolean {
	return side.sounds.length === 0 && !/<img|<video|<audio|<canvas|<input|<textarea/i.test(side.html) && side.html.replace(/<[^>]+>/g, "").trim() === "";
}

function builtinSide(html: string): RenderedSide {
	const { html: withButtons, sounds } = extractSounds(html);
	return { html: withButtons, css: BUILTIN_CARD_CSS, builtin: true, sounds, autoplay: sounds };
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
