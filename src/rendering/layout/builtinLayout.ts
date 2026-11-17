import type { CardRef } from "../../domain/types";
import { escapeHtml, stripHtml } from "../../utils/strings";
import type { Side } from "../cloze";
import { renderCloze } from "../cloze";
import { renderTypeComparison, TYPE_ANSWER_INPUT } from "../typeAnswer";
import type { CardKind } from "./cardKind";
import type { FieldRole, RoleMap } from "./fieldRoles";

/**
 * The plugin's own card design, used instead of the deck's template. A card
 * is laid out like a dictionary entry: the headword, its reading in red, the
 * part of speech and meaning, then a ruled-off example with its translation,
 * the picture and the audio. The question side shows only what's asked.
 */
export function renderBuiltinSide(ref: CardRef, roles: RoleMap, kind: CardKind, side: Side, typedAnswer = ""): string {
	const field = (role: FieldRole): string => {
		const index = roles[role];
		return index === undefined ? "" : (ref.note.fields[index] ?? "");
	};
	const has = (role: FieldRole) => stripHtml(field(role).replace(/\[sound:[^\]]+\]/g, "x")) !== "" || /<img/i.test(field(role));
	const clozeOrdinal = ref.noteType.kind === "cloze" ? ref.card.ord + 1 : null;
	const text = (role: FieldRole) => (clozeOrdinal ? renderCloze(field(role), clozeOrdinal, side) : field(role));

	if (side === "front") return frontSide(kind, text, has, tidyList(field("partOfSpeech")));

	const parts: string[] = [`<article class="fc-entry is-answer is-${kind.direction}">`];
	parts.push('<header class="fc-entry-head">');
	parts.push(`<div class="fc-entry-word">${text("word")}</div>`);
	if (has("reading") || has("audio")) {
		parts.push('<div class="fc-entry-reading">');
		if (has("reading")) parts.push(`<span>${field("reading")}</span>`);
		if (has("audio")) parts.push(`<span class="fc-entry-audio">${soundOnly(field("audio"))}</span>`);
		parts.push("</div>");
	}
	parts.push("</header>");

	parts.push('<section class="fc-entry-sense">');
	if (has("partOfSpeech")) parts.push(`<div class="fc-entry-pos">${tidyList(field("partOfSpeech"))}</div>`);
	parts.push(`<div class="fc-entry-meaning">${text("meaning")}</div>`);
	parts.push("</section>");

	if (kind.input === "type") parts.push(typedBlock(kind, typedAnswer, stripHtml(field("word"))));
	if (kind.input === "draw") parts.push('<figure class="fc-entry-drawing" id="fc-drawing-result" hidden><img alt="Your writing"><figcaption>Your writing</figcaption></figure>');

	if (has("example") || has("exampleMeaning")) {
		parts.push('<section class="fc-entry-example">');
		if (has("example")) {
			parts.push(`<div class="fc-entry-example-text">${field("example")}`);
			if (has("exampleAudio")) parts.push(` <span class="fc-entry-audio">${soundOnly(field("exampleAudio"))}</span>`);
			parts.push("</div>");
		}
		if (has("exampleReading")) parts.push(`<div class="fc-entry-example-reading">${field("exampleReading")}</div>`);
		if (has("exampleMeaning")) parts.push(`<div class="fc-entry-example-meaning">${field("exampleMeaning")}</div>`);
		parts.push("</section>");
	}
	if (has("image")) parts.push(`<figure class="fc-entry-image">${imagesOnly(field("image"))}</figure>`);
	parts.push("</article>");
	if (kind.input === "draw") parts.push(`<script>${SHOW_DRAWING_SCRIPT}</script>`);
	return parts.join("");
}

function frontSide(kind: CardKind, text: (role: FieldRole) => string, has: (role: FieldRole) => boolean, partOfSpeech: string): string {
	const parts: string[] = [`<article class="fc-entry is-question is-${kind.direction}">`];
	if (kind.direction === "recognition") {
		parts.push(`<div class="fc-entry-word">${text("word")}</div>`);
	} else {
		if (has("partOfSpeech")) parts.push(`<div class="fc-entry-pos">${partOfSpeech}</div>`);
		parts.push(`<div class="fc-entry-meaning is-prompt">${text("meaning")}</div>`);
		if (has("exampleMeaning")) parts.push(`<div class="fc-entry-hint">${text("exampleMeaning")}</div>`);
	}
	if (kind.input === "type") {
		const placeholder = kind.direction === "recognition" ? "Type the meaning" : "Type the word";
		parts.push(`<div class="fc-entry-input">${TYPE_ANSWER_INPUT.replace("<input ", `<input placeholder="${placeholder}" `)}</div>`);
	}
	if (kind.input === "draw") parts.push(DRAWING_PAD);
	parts.push("</article>");
	if (kind.input === "draw") parts.push(`<script>${DRAWING_SCRIPT}</script>`);
	return parts.join("");
}

/** On the back: production cards are compared character by character, recognition answers are shown for self-grading. */
function typedBlock(kind: CardKind, typed: string, expectedWord: string): string {
	if (kind.direction === "production") return `<div class="fc-entry-typed">${renderTypeComparison(typed, expectedWord)}</div>`;
	if (!typed.trim()) return "";
	return `<div class="fc-entry-typed"><span class="fc-entry-typed-label">You wrote</span> ${escapeHtml(typed)}</div>`;
}

/**
 * Part-of-speech fields are often lists split by line breaks and CJK
 * punctuation ("verb、<br>preposition、"). Set them as one Latin list when
 * the words are Latin, so they read on a single line.
 */
export function tidyList(value: string): string {
	const flat = value.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
	if (!/[A-Za-z]/.test(stripHtml(flat))) return flat;
	return flat
		.replace(/\s*[、，,]\s*/g, ", ")
		.replace(/（/g, "(")
		.replace(/）/g, ")")
		.replace(/\(\s*/g, "(")
		.replace(/\s*\)/g, ")")
		.replace(/,\s*\)/g, ")")
		.replace(/[,\s]+$/, "");
}

/** Keeps only the [sound:] tags of a field (they become replay buttons). */
function soundOnly(value: string): string {
	return (value.match(/\[sound:[^\]]+\]/g) ?? []).join(" ");
}

function imagesOnly(value: string): string {
	return (value.match(/<img\b[^>]*>/gi) ?? []).join("");
}

const DRAWING_PAD =
	'<div class="fc-pad"><canvas id="fc-pad-canvas" width="560" height="560" aria-label="Writing pad"></canvas>' +
	'<button type="button" class="fc-pad-clear" id="fc-pad-clear" aria-label="Clear">Clear</button></div>';

/** A practice-paper writing pad; the drawing is kept in sessionStorage so the back can show it. */
const DRAWING_SCRIPT = `(function () {
	var canvas = document.getElementById("fc-pad-canvas");
	if (!canvas) return;
	var ctx = canvas.getContext("2d");
	var ink = getComputedStyle(document.body).getPropertyValue("--fc-ink").trim() || "#222";
	var drawing = false;
	ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 14; ctx.strokeStyle = ink;
	function point(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
	canvas.addEventListener("pointerdown", function (e) { drawing = true; canvas.setPointerCapture(e.pointerId); var p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
	canvas.addEventListener("pointermove", function (e) { if (!drawing) return; var p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
	function finish() { if (!drawing) return; drawing = false; try { sessionStorage.setItem("fc-drawing", canvas.toDataURL("image/png")); } catch (e) {} }
	canvas.addEventListener("pointerup", finish); canvas.addEventListener("pointercancel", finish);
	document.getElementById("fc-pad-clear").addEventListener("click", function () { ctx.clearRect(0, 0, canvas.width, canvas.height); try { sessionStorage.removeItem("fc-drawing"); } catch (e) {} });
})();`;

const SHOW_DRAWING_SCRIPT = `(function () {
	var data = null;
	try { data = sessionStorage.getItem("fc-drawing"); } catch (e) {}
	var figure = document.getElementById("fc-drawing-result");
	if (data && figure) { figure.querySelector("img").src = data; figure.hidden = false; }
})();`;

/**
 * Styles for the built-in layout. Colours come from CSS variables the
 * plugin sets from the active Obsidian theme (see cardDocument.ts).
 */
export const BUILTIN_CARD_CSS = `
html, body { background: var(--fc-ground); }
body.card { font-family: var(--fc-font); font-size: 18px; color: var(--fc-ink); text-align: left; padding: 0; }
.fc-entry { max-width: 640px; margin: 0 auto; padding: 56px 28px 64px; }
.fc-entry.is-question { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
.fc-entry-word { font-size: 56px; font-weight: 600; line-height: 1.1; }
.fc-entry-meaning.is-prompt { font-size: clamp(24px, 4.5vw, 32px); font-weight: 500; line-height: 1.3; max-width: 26ch; text-wrap: balance; }
.fc-entry-hint { color: var(--fc-muted); font-size: 16px; max-width: 40ch; }
.fc-entry-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 18px; padding-bottom: 14px; border-bottom: 2px solid var(--fc-red); }
.fc-entry.is-question .fc-entry-word { padding-bottom: 16px; }
.fc-entry-reading { display: flex; align-items: center; gap: 8px; color: var(--fc-ink); font-size: 24px; font-weight: 400; }
.fc-entry-sense { padding: 18px 0 6px; }
.fc-entry-pos { color: var(--fc-faint); font-size: 14px; font-style: italic; margin-bottom: 4px; text-wrap: balance; }
.fc-entry.is-question .fc-entry-pos { margin: 0; }
.fc-entry-meaning { font-size: 22px; line-height: 1.4; text-wrap: pretty; }
.fc-entry-example { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--fc-rule); }
.fc-entry-example-text { font-size: 20px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
.fc-entry-example-reading { color: var(--fc-muted); font-size: 15px; margin-top: 2px; }
.fc-entry-example-meaning { margin-top: 6px; color: var(--fc-ink); opacity: .85; font-size: 16px; }
.fc-entry-image { margin: 24px 0 0; }
.fc-entry-image img { display: block; max-width: 100%; max-height: 240px; border-radius: 8px; margin: 0; }
.fc-entry-typed { margin-top: 14px; font-size: 16px; color: var(--fc-muted); }
.fc-entry-typed-label { color: var(--fc-faint); font-size: 13px; margin-right: 6px; }
.fc-entry-input { width: min(420px, 100%); }
#typeans.fc-typeans { width: 100%; box-sizing: border-box; padding: 12px 14px; font: inherit; font-size: 20px; color: var(--fc-ink); background: transparent; border: 1px solid var(--fc-rule-strong); border-radius: 8px; outline: none; }
#typeans.fc-typeans:focus { border-color: var(--fc-ink); }
code#typeans { font-family: inherit; font-size: 20px; }
.fc-entry-audio .replay-button { margin: 0; }
.fc-entry-audio .replay-button svg { width: 26px; height: 26px; }
.fc-entry-audio .replay-button svg circle { fill: transparent; stroke: var(--fc-muted); stroke-width: 3; }
.fc-entry-audio .replay-button svg path { fill: var(--fc-muted); }
.fc-entry-audio .replay-button:hover svg circle { stroke: var(--fc-ink); }
.fc-entry-audio .replay-button:hover svg path { fill: var(--fc-ink); }
.fc-pad { position: relative; width: min(280px, 70vw); aspect-ratio: 1; border: 1.5px solid var(--fc-rule-strong); border-radius: 4px;
	background:
		linear-gradient(to right, transparent calc(50% - .5px), var(--fc-rule) calc(50% - .5px), var(--fc-rule) calc(50% + .5px), transparent calc(50% + .5px)),
		linear-gradient(to bottom, transparent calc(50% - .5px), var(--fc-rule) calc(50% - .5px), var(--fc-rule) calc(50% + .5px), transparent calc(50% + .5px)); }
.fc-pad canvas { width: 100%; height: 100%; touch-action: none; cursor: crosshair; display: block; }
.fc-pad-clear { position: absolute; right: -2px; bottom: -36px; font: inherit; font-size: 13px; color: var(--fc-muted); background: none; border: none; cursor: pointer; }
.fc-entry-drawing { margin: 16px 0 0; display: inline-flex; flex-direction: column; gap: 4px; }
.fc-entry-drawing img { width: 120px; height: 120px; border: 1px solid var(--fc-rule-strong); border-radius: 4px; }
.fc-entry-drawing figcaption { color: var(--fc-faint); font-size: 12px; }
.cloze { font-weight: 600; text-decoration: underline; text-decoration-color: var(--fc-rule-strong); text-underline-offset: 4px; }
`;
