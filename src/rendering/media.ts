import { decodeEntities } from "../utils/strings";

/** Resolves a media file name from a card to a URL the card frame can load, or null if unknown. */
export type MediaResolver = (name: string) => string | null;

const SOUND_TAG = /\[sound:([^\]]+)\]/g;

/** Anki's replay button markup, so deck CSS that styles `.replay-button` keeps working. */
function replayButton(index: number): string {
	return (
		`<a class="replay-button soundLink" href="#" data-fc-sound="${index}" aria-label="Play audio">` +
		'<svg class="playImage" viewBox="0 0 64 64" version="1.1"><circle cx="32" cy="32" r="29"></circle>' +
		'<path d="M56.502,32.301l-37.502,20.101l0.329,-40.804l37.173,20.703Z"></path></svg></a>'
	);
}

export interface SoundExtraction {
	html: string;
	sounds: string[];
}

/**
 * Replaces `[sound:file]` tags with replay buttons. Indices continue from
 * `offset` so the buttons of the front and back sides stay distinct.
 */
export function extractSounds(html: string, offset = 0): SoundExtraction {
	const sounds: string[] = [];
	const replaced = html.replace(SOUND_TAG, (_match, name: string) => {
		sounds.push(decodeEntities(name.trim()));
		return replayButton(offset + sounds.length - 1);
	});
	return { html: replaced, sounds };
}

const SRC_ATTRIBUTE = /(\s(?:src|poster)\s*=\s*)(["'])(.*?)\2/gi;
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;

/** Rewrites relative `src` attributes and CSS `url()`s to the stored media files. */
export function rewriteMediaUrls(html: string, resolve: MediaResolver): string {
	return html
		.replace(SRC_ATTRIBUTE, (match, prefix: string, quote: string, value: string) => {
			const url = resolveRelative(value, resolve);
			return url ? `${prefix}${quote}${url}${quote}` : match;
		})
		.replace(CSS_URL, (match, quote: string, value: string) => {
			const url = resolveRelative(value, resolve);
			return url ? `url(${quote}${url}${quote})` : match;
		});
}

/** Every relative media name referenced by `src` attributes or CSS `url()`s, in all its spellings. */
export function collectMediaReferences(html: string): string[] {
	const names = new Set<string>();
	rewriteMediaUrls(html, (name) => {
		names.add(name);
		return null;
	});
	return [...names];
}

const MIME_TYPES: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	avif: "image/avif",
	bmp: "image/bmp",
	ttf: "font/ttf",
	otf: "font/otf",
	woff: "font/woff",
	woff2: "font/woff2",
	mp3: "audio/mpeg",
	ogg: "audio/ogg",
	wav: "audio/wav",
	m4a: "audio/mp4",
	mp4: "video/mp4",
	webm: "video/webm",
};

export function mimeType(name: string): string {
	const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
	return MIME_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Encodes a media file as a data: URI. Card frames are sandboxed with an
 * opaque origin, which can't load the vault's app:// or capacitor:// URLs,
 * so images and fonts are handed to them inline.
 */
export function toDataUri(bytes: Uint8Array, name: string): string {
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return `data:${mimeType(name)};base64,${btoa(binary)}`;
}

function resolveRelative(value: string, resolve: MediaResolver): string | null {
	const trimmed = value.trim();
	if (trimmed === "" || /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(trimmed)) return null;
	const decoded = decodeEntities(trimmed);
	const candidates = [decoded];
	try {
		candidates.push(decodeURIComponent(decoded));
	} catch {
		// Not percent-encoded; the plain name is enough.
	}
	for (const candidate of candidates) {
		const url = resolve(candidate);
		if (url) return url;
	}
	return null;
}
