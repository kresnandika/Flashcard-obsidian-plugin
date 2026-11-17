import JSZip from "jszip";
import type { SqlJsStatic } from "sql.js";
import { DECK_SEPARATOR } from "../domain/deckTree";
import { UserFacingError } from "../utils/errors";
import { readLegacyCollection } from "./legacySchema";
import { parseLegacyMediaList, parseModernMediaList } from "./media";
import { readModernCollection } from "./modernSchema";
import { ProtoMessage } from "./protobuf";
import { tableExists } from "./sqlite";
import type { CollectionContent, PackageMedia, ParsedPackage } from "./types";
import { maybeDecompress } from "./zstd";

/** `PackageMetadata.Version` from Anki's `import_export.proto`. */
enum PackageVersion {
	Unknown = 0,
	Legacy1 = 1,
	Legacy2 = 2,
	Latest = 3,
}

/**
 * Reads an Anki `.apkg` (deck package) or `.colpkg` (collection package).
 * Supports every format Anki has written: collection.anki2, collection.anki21
 * and the zstd-compressed collection.anki21b.
 */
export async function readAnkiPackage(data: ArrayBuffer | Uint8Array, fileName: string, sqlite: SqlJsStatic): Promise<ParsedPackage> {
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(data);
	} catch (error) {
		throw new UserFacingError(`${fileName} isn't a valid Anki package (it's not a zip file).`, { cause: error });
	}

	const version = await readVersion(zip);
	const collectionFile = pickCollectionFile(zip, version);
	if (!collectionFile) throw new UserFacingError(`${fileName} doesn't contain an Anki collection.`);

	const raw = maybeDecompress(await collectionFile.async("uint8array"));
	const db = new sqlite.Database(raw);
	let content: CollectionContent;
	try {
		content = tableExists(db, "notetypes") ? readModernCollection(db) : readLegacyCollection(db);
	} finally {
		db.close();
	}

	if (Object.keys(content.cards).length === 0) {
		throw new UserFacingError(`${fileName} has no cards. If it was exported from a recent Anki, try exporting again with "Support older Anki versions" ticked.`);
	}

	return {
		name: packageName(content, fileName),
		...content,
		media: await readMediaList(zip, version),
	};
}

async function readVersion(zip: JSZip): Promise<PackageVersion> {
	const meta = zip.file("meta");
	if (!meta) return PackageVersion.Unknown;
	const message = ProtoMessage.decode(await meta.async("uint8array"));
	return message.number(1, PackageVersion.Unknown) as PackageVersion;
}

function pickCollectionFile(zip: JSZip, version: PackageVersion): JSZip.JSZipObject | null {
	const order =
		version === PackageVersion.Latest
			? ["collection.anki21b", "collection.anki21", "collection.anki2"]
			: ["collection.anki21", "collection.anki2", "collection.anki21b"];
	for (const name of order) {
		const file = zip.file(name);
		if (file) return file;
	}
	return null;
}

async function readMediaList(zip: JSZip, version: PackageVersion): Promise<PackageMedia[]> {
	const listFile = zip.file("media");
	if (!listFile) return [];
	const bytes = await listFile.async("uint8array");
	const entries =
		version === PackageVersion.Latest ? parseModernMediaList(maybeDecompress(bytes)) : parseLegacyMediaList(new TextDecoder().decode(bytes));

	const media: PackageMedia[] = [];
	for (const [zipName, name] of entries) {
		const file = zip.file(zipName);
		if (!file || !name) continue;
		media.push({ name, read: async () => maybeDecompress(await file.async("uint8array")) });
	}
	return media;
}

/**
 * Names the package after the deepest deck that still holds nearly all of its
 * cards, e.g. "HSK 1 (300 Words)" rather than the shared top-level "HSK 3.0".
 */
function packageName(content: CollectionContent, fileName: string): string {
	const deckNames = Object.values(content.cards)
		.map((card) => content.decks[card.deckId]?.name)
		.filter((name): name is string => Boolean(name));
	const threshold = Math.ceil(deckNames.length * 0.9);

	let prefix: string[] = [];
	for (;;) {
		const counts = new Map<string, number>();
		for (const name of deckNames) {
			const parts = name.split(DECK_SEPARATOR);
			if (parts.length <= prefix.length || !prefix.every((part, i) => parts[i] === part)) continue;
			const next = parts[prefix.length];
			counts.set(next, (counts.get(next) ?? 0) + 1);
		}
		const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
		if (!best || best[1] < threshold) break;
		prefix = [...prefix, best[0]];
	}
	return prefix.length > 0 ? prefix[prefix.length - 1] : fileName.replace(/\.(apkg|colpkg)$/i, "");
}
