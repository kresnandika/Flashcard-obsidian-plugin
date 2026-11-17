import { ProtoMessage } from "./protobuf";

/** Characters that aren't allowed in file names on at least one platform Obsidian runs on. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what must be removed
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** A file-system-safe version of a media file name, or the name itself if it's already safe. */
export function safeMediaName(name: string): string {
	const safe = name.replace(UNSAFE_FILE_CHARS, "_").replace(/^\.+/, "_").trim();
	return safe || "_";
}

/** Legacy packages list media as JSON: `{"0": "cat.jpg", ...}`, keyed by zip entry name. */
export function parseLegacyMediaList(json: string): Map<string, string> {
	const parsed = JSON.parse(json || "{}") as Record<string, string>;
	return new Map(Object.entries(parsed));
}

/**
 * Modern packages list media as a protobuf `MediaEntries` message. The zip
 * entry of each file is its index, unless `legacy_zip_filename` (255) is set.
 */
export function parseModernMediaList(bytes: Uint8Array): Map<string, string> {
	const entries = ProtoMessage.decode(bytes).messages(1);
	const map = new Map<string, string>();
	entries.forEach((entry, index) => {
		const zipName = entry.has(255) ? String(entry.number(255)) : String(index);
		map.set(zipName, entry.string(1));
	});
	return map;
}
