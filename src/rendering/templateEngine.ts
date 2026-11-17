import { escapeHtml, stripHtml } from "../utils/strings";
import { clozeAnswers, hasCloze, renderCloze, type Side } from "./cloze";
import { furigana, kanaOnly, kanjiOnly } from "./furigana";
import { renderTypeComparison, TYPE_ANSWER_INPUT } from "./typeAnswer";

/**
 * Renders Anki card templates: `{{Field}}`, `{{#Field}}…{{/Field}}`,
 * `{{^Field}}…{{/Field}}`, filters such as `{{hint:Field}}` and
 * `{{cloze:Text}}`, and the special fields FrontSide, Tags, Deck, Subdeck,
 * Card and Type. Filters apply right to left, as in Anki.
 */

export interface TemplateContext {
	fields: Record<string, string>;
	side: Side;
	tags: string[];
	deckName: string;
	noteTypeName: string;
	cardName: string;
	/** The rendered front, available to `{{FrontSide}}` on the back. */
	frontSide?: string;
	/** 1-based cloze number for cloze note types. */
	clozeOrdinal?: number;
	/** What was typed into `{{type:…}}` on the front, compared on the back. */
	typedAnswer?: string;
}

type TemplateNode =
	| { kind: "text"; text: string }
	| { kind: "field"; name: string; filters: string[] }
	| { kind: "section"; name: string; inverted: boolean; children: TemplateNode[] };

export function renderTemplate(template: string, context: TemplateContext): string {
	let hintCounter = 0;
	const nextHintId = () => `fc-hint-${++hintCounter}`;
	return renderNodes(parseTemplate(template), context, nextHintId);
}

export function parseTemplate(template: string): TemplateNode[] {
	const root: TemplateNode[] = [];
	const stack: { name: string; children: TemplateNode[] }[] = [{ name: "", children: root }];
	const tagPattern = /\{\{([\s\S]*?)\}\}/g;
	let last = 0;

	for (const match of template.matchAll(tagPattern)) {
		const children = stack[stack.length - 1].children;
		if (match.index > last) children.push({ kind: "text", text: template.slice(last, match.index) });
		last = match.index + match[0].length;

		const tag = match[1].trim();
		const sigil = tag[0];
		if (sigil === "#" || sigil === "^") {
			const section: TemplateNode = { kind: "section", name: tag.slice(1).trim(), inverted: sigil === "^", children: [] };
			children.push(section);
			stack.push({ name: section.name, children: section.children });
		} else if (sigil === "/") {
			const name = tag.slice(1).trim();
			// Anki rejects mismatched sections; we close the nearest one so a typo doesn't blank the card.
			if (stack.length > 1) {
				const index = findLastIndex(stack, (frame) => frame.name === name);
				stack.length = index > 0 ? index : stack.length - 1;
			}
		} else if (sigil !== "!") {
			const parts = tag.split(":");
			const name = parts.pop()?.trim() ?? "";
			children.push({ kind: "field", name, filters: parts.map((part) => part.trim()) });
		}
	}
	if (last < template.length) stack[stack.length - 1].children.push({ kind: "text", text: template.slice(last) });
	return root;
}

function renderNodes(nodes: TemplateNode[], context: TemplateContext, nextHintId: () => string): string {
	let out = "";
	for (const node of nodes) {
		switch (node.kind) {
			case "text":
				out += node.text;
				break;
			case "field":
				out += renderField(node.name, node.filters, context, nextHintId);
				break;
			case "section": {
				const visible = isSectionTruthy(node.name, context) !== node.inverted;
				if (visible) out += renderNodes(node.children, context, nextHintId);
				break;
			}
		}
	}
	return out;
}

function isSectionTruthy(name: string, context: TemplateContext): boolean {
	const clozeSection = /^c(\d+)$/.exec(name);
	if (clozeSection && context.clozeOrdinal !== undefined && !(name in context.fields)) {
		return Number(clozeSection[1]) === context.clozeOrdinal;
	}
	const value = specialField(name, context) ?? context.fields[name];
	if (value === undefined) return false;
	return stripHtml(value) !== "" || /<img|\[sound:/i.test(value);
}

function specialField(name: string, context: TemplateContext): string | undefined {
	switch (name) {
		case "FrontSide":
			return context.side === "back" ? (context.frontSide ?? "") : "";
		case "Tags":
			return context.tags.join(" ");
		case "Deck":
			return context.deckName;
		case "Subdeck": {
			const parts = context.deckName.split("::");
			return parts[parts.length - 1];
		}
		case "Card":
			return context.cardName;
		case "Type":
			return context.noteTypeName;
		case "CardFlag":
			return "";
		default:
			return undefined;
	}
}

function renderField(name: string, filters: string[], context: TemplateContext, nextHintId: () => string): string {
	const special = specialField(name, context);
	const raw = special ?? context.fields[name];
	if (raw === undefined) return `<span class="fc-template-error">Unknown field: ${escapeHtml(name)}</span>`;

	// `type` consumes the field (and an inner `cloze`), so it's handled before the filter chain.
	const typeIndex = filters.findIndex((filter) => filter === "type" || filter.startsWith("type-"));
	if (typeIndex >= 0) {
		if (context.side === "front") return TYPE_ANSWER_INPUT;
		const expected = filters.includes("cloze") && context.clozeOrdinal ? clozeAnswers(raw, context.clozeOrdinal) : raw;
		return renderTypeComparison(context.typedAnswer ?? "", stripHtml(expected));
	}

	let value = raw;
	for (let i = filters.length - 1; i >= 0; i--) value = applyFilter(filters[i], value, name, context, nextHintId);
	return value;
}

function applyFilter(filter: string, value: string, fieldName: string, context: TemplateContext, nextHintId: () => string): string {
	switch (filter) {
		case "text":
			return stripHtml(value);
		case "cloze":
			return context.clozeOrdinal === undefined ? value : renderCloze(value, context.clozeOrdinal, context.side);
		case "cloze-only":
			return context.clozeOrdinal === undefined ? value : clozeAnswers(value, context.clozeOrdinal);
		case "hint": {
			if (stripHtml(value) === "") return "";
			const id = nextHintId();
			return `<a class="hint" href="#" data-fc-hint="${id}">Show ${escapeHtml(fieldName)}</a><div id="${id}" class="hint" style="display: none">${value}</div>`;
		}
		case "furigana":
			return furigana(value);
		case "kana":
			return kanaOnly(value);
		case "kanji":
			return kanjiOnly(value);
		default:
			// tts, tts-voices and unknown add-on filters: show the field unchanged.
			return value;
	}
}

/** Whether a cloze card still has its cloze in the note (it can be deleted by editing). */
export function clozeCardExists(fields: string[], ordinal: number): boolean {
	return fields.some((field) => hasCloze(field, ordinal));
}

function findLastIndex<T>(list: T[], predicate: (item: T) => boolean): number {
	for (let i = list.length - 1; i >= 0; i--) if (predicate(list[i])) return i;
	return -1;
}
