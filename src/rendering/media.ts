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
