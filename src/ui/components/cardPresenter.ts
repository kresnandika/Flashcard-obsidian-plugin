import type { CardRef } from "../../domain/types";
import { buildCardDocument, type CardTheme } from "../../rendering/cardDocument";
import type { RenderedSide } from "../../rendering/renderCard";
import type { PackageRepository } from "../../storage/PackageRepository";
import type { CardFrame } from "./CardFrame";

/** Reads Obsidian's current theme so cards match light or dark mode. */
export function currentTheme(followObsidian: boolean): CardTheme {
	const dark = followObsidian && document.body.classList.contains("theme-dark");
	const textColor = getComputedStyle(document.body).getPropertyValue("--text-normal").trim() || (dark ? "#ddd" : "#222");
	return { dark, textColor: followObsidian ? textColor : "#000" };
}

export interface PresentOptions {
	followTheme: boolean;
	runDeckScripts: boolean;
}

/** Puts one rendered side of a card into a frame, with media resolved from the card's package. */
export function presentSide(frame: CardFrame, repository: PackageRepository, ref: CardRef, side: RenderedSide, options: PresentOptions): void {
	const hasInput = /<textarea|<input/i.test(side.html);
	const html = buildCardDocument({
		html: side.html,
		css: ref.noteType.css,
		ord: ref.card.ord,
		theme: currentTheme(options.followTheme),
		resolveMedia: (name) => repository.mediaUrl(ref.pkg, name),
		runDeckScripts: options.runDeckScripts,
		token: frame.nextToken(),
		storage: { ...frame.storage },
		focusEditable: hasInput,
	});
	frame.show(html, hasInput);
}

export function soundUrls(repository: PackageRepository, ref: CardRef, names: string[]): string[] {
	return names.map((name) => repository.mediaUrl(ref.pkg, name)).filter((url): url is string => url !== null);
}
