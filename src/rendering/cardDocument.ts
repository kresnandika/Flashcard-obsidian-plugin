import { BASE_CARD_CSS } from "./baseStyles";
import { bridgeScript } from "./bridgeScript";
import { rewriteMediaUrls, type MediaResolver } from "./media";

export interface CardTheme {
	dark: boolean;
	textColor: string;
}

export interface CardDocumentOptions {
	/** Rendered side, sound tags already replaced. */
	html: string;
	css: string;
	/** Template index; the body gets the classes `card card{ord+1}` like Anki. */
	ord: number;
	theme: CardTheme;
	resolveMedia: MediaResolver;
	runDeckScripts: boolean;
	token: string;
	storage: Record<string, string>;
	focusEditable: boolean;
}

/** Builds the full HTML document loaded into the sandboxed card frame. */
export function buildCardDocument(options: CardDocumentOptions): string {
	const body = rewriteMediaUrls(options.runDeckScripts ? options.html : stripScripts(options.html), options.resolveMedia);
	const css = rewriteMediaUrls(options.css, options.resolveMedia);
	const nightBody = options.theme.dark ? " nightMode night_mode" : "";
	const nightHtml = options.theme.dark ? ' class="night-mode"' : "";
	const vars = `:root{--fc-scheme:${options.theme.dark ? "dark" : "light"};--fc-text:${cssValue(options.theme.textColor)};}`;
	const bridge = bridgeScript({ token: options.token, storage: options.storage, focusEditable: options.focusEditable });

	return `<!doctype html>
<html${nightHtml}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${vars}${BASE_CARD_CSS}</style>
<style>${escapeStyle(css)}</style>
<script>${bridge}</script>
</head>
<body class="card card${options.ord + 1}${nightBody}">
<div id="qa">${body}</div>
</body>
</html>`;
}

/** Removes `<script>` elements and inline event handlers from deck HTML. */
export function stripScripts(html: string): string {
	return html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function escapeStyle(css: string): string {
	return css.replace(/<\/style/gi, "<\\/style");
}

function cssValue(value: string): string {
	return value.replace(/[;{}<>]/g, "");
}
