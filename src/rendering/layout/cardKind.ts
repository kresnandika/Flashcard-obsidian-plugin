import type { CardTemplate, NoteType } from "../../domain/types";
import type { RoleMap } from "./fieldRoles";

/** Which way a card asks: show the word and recall its meaning, or the reverse. */
export type CardDirection = "recognition" | "production";

/** How the answer is given before revealing it. */
export type AnswerInput = "none" | "type" | "draw";

export interface CardKind {
	direction: CardDirection;
	input: AnswerInput;
}

/**
 * Reads a deck template to decide what the built-in layout should ask. The
 * front template tells us the direction (does it show the word?) and whether
 * the deck expected typing (a text box or {{type:}}) or drawing (a canvas).
 */
export function detectCardKind(noteType: NoteType, template: CardTemplate, roles: RoleMap): CardKind {
	// Scripts and comments often mention fields (e.g. a storage key built from {{Hanzi}}) without showing them.
	const front = template.front.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
	const rawFront = template.front;
	const shows = (index: number | undefined): boolean => {
		if (index === undefined) return false;
		const name = escapeRegExp(noteType.fields[index] ?? "");
		return new RegExp(`\\{\\{[^}]*?(?<![\\w-])${name}\\s*\\}\\}`).test(front) && !new RegExp(`\\{\\{\\s*type:[^}]*${name}\\s*\\}\\}`).test(front);
	};

	const direction: CardDirection = shows(roles.word) || !shows(roles.meaning) ? "recognition" : "production";
	const name = template.name.toLowerCase();
	let input: AnswerInput = "none";
	if (/<canvas\b/i.test(rawFront) || /(writ|draw|stroke)/.test(name)) input = "draw";
	else if (/\{\{\s*type:/i.test(rawFront) || /<textarea\b|<input\b/i.test(rawFront) || /typ/.test(name)) input = "type";
	return { direction, input };
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
