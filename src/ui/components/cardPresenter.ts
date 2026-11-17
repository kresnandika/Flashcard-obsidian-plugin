import type { CardRef } from "../../domain/types";
import { buildCardDocument, type CardTheme } from "../../rendering/cardDocument";
import type { RenderedSide } from "../../rendering/renderCard";
import type { PackageRepository } from "../../storage/PackageRepository";
import type { CardFrame } from "./CardFrame";
import type { MediaInliner } from "./MediaInliner";

/** Reads Obsidian's current theme so cards match light or dark mode. */
export function currentTheme(followObsidian: boolean): CardTheme {
	const style = getComputedStyle(document.body);
	const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
	const dark = followObsidian && document.body.classList.contains("theme-dark");
	if (!followObsidian) return { dark: false, textColor: "#000", ground: "#fff", muted: "#555", faint: "#888", accent: "#b8392c", font: "system-ui, sans-serif" };
	return {
		dark,
		textColor: read("--text-normal", dark ? "#ddd" : "#222"),
		ground: read("--background-primary", dark ? "#1e1e1e" : "#fff"),
		muted: read("--text-muted", dark ? "#aaa" : "#555"),
		faint: read("--text-faint", dark ? "#777" : "#888"),
		accent: readAccent(dark),
		font: read("--font-text", style.fontFamily || "system-ui, sans-serif"),
	};
}

export interface PresentOptions {
	followTheme: boolean;
	runDeckScripts: boolean;
}

/**
 * Puts one rendered side of a card into a frame. Images and fonts are
 * inlined first (the sandboxed frame can't load vault URLs). If another side
 * was requested meanwhile, this one is dropped.
 */
export async function presentSide(frame: CardFrame, media: MediaInliner, ref: CardRef, side: RenderedSide, options: PresentOptions): Promise<void> {
	const ticket = frame.beginRender();
	const resolveMedia = await media.resolverFor(ref.pkg, `${side.html}\n${side.css}`);
	if (!frame.isCurrentRender(ticket)) return;

	const hasInput = /<textarea|<input/i.test(side.html);
	const html = buildCardDocument({
		html: side.html,
		css: side.css,
		ord: ref.card.ord,
		theme: currentTheme(options.followTheme),
		resolveMedia,
		runDeckScripts: options.runDeckScripts,
		token: frame.nextToken(),
		storage: { ...frame.storage },
		focusEditable: hasInput,
	});
	frame.show(html, hasInput);
}

/** Audio plays outside the frame, so it can use the vault's own URLs. */
export function soundUrls(repository: PackageRepository, ref: CardRef, names: string[]): string[] {
	return names.map((name) => repository.mediaUrl(ref.pkg, name)).filter((url): url is string => url !== null);
}

/** The dictionary red from the plugin stylesheet, so the card and the chrome share one value. */
function readAccent(dark: boolean): string {
	const view = document.querySelector(".fc-view");
	const value = view ? getComputedStyle(view).getPropertyValue("--fc-red").trim() : "";
	return value || (dark ? "#d4604f" : "#b8392c");
}
