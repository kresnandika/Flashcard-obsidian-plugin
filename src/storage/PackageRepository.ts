import { safeMediaName } from "../anki/media";
import type { ParsedPackage } from "../anki/types";
import { MEDIA_FOLDER, PACKAGE_FILE, PROGRESS_FILE, STORAGE_SCHEMA_VERSION } from "../constants";
import { Collection } from "../domain/Collection";
import type { LoadedPackage, PackageData, ProgressData } from "../domain/types";
import { debounce, type Debounced } from "../utils/debounce";
import { errorMessage, UserFacingError } from "../utils/errors";
import { slugify } from "../utils/strings";
import { joinPath, type FileSystem } from "./FileSystem";
import { guidOverlap, mergeIntoPackage, type MergeResult } from "./packageMerge";

export interface LoadReport {
	loaded: number;
	failed: { folder: string; error: string }[];
}

export interface ImportProgress {
	stage: "reading" | "media" | "saving";
	done: number;
	total: number;
}

export interface ImportReport extends MergeResult {
	packageName: string;
	updatedExisting: boolean;
	mediaWritten: number;
}

const PROGRESS_SAVE_DELAY_MS = 1500;

/**
 * Loads and saves packages in the data folder and keeps the in-memory
 * Collection in sync with them. Each package is a folder:
 *
 *   <data folder>/<package>/collection.json   notes, cards, decks, note types
 *   <data folder>/<package>/progress.json     scheduling state and review log
 *   <data folder>/<package>/media/            images and audio
 */
export class PackageRepository {
	readonly collection = new Collection();
	private readonly progressSavers = new Map<string, Debounced<[]>>();
	/** Last content written per path, to tell our own writes from sync changes. */
	private readonly lastWritten = new Map<string, string>();

	constructor(
		private readonly fs: FileSystem,
		private readonly dataFolder: () => string,
	) {}

	async loadAll(): Promise<LoadReport> {
		const report: LoadReport = { loaded: 0, failed: [] };
		for (const pkg of this.collection.allPackages()) this.collection.removePackage(pkg.data.id);
		for (const folder of await this.fs.listFolders(this.dataFolder())) {
			try {
				if (await this.loadFolder(folder)) report.loaded++;
			} catch (error) {
				report.failed.push({ folder, error: errorMessage(error) });
			}
		}
		return report;
	}

	/** (Re)loads one package folder. Returns false when it isn't a package. */
	async loadFolder(folder: string): Promise<boolean> {
		const packagePath = joinPath(folder, PACKAGE_FILE);
		if (!(await this.fs.exists(packagePath))) return false;

		const packageText = await this.fs.readText(packagePath);
		const data = JSON.parse(packageText) as PackageData;
		if (data.schema > STORAGE_SCHEMA_VERSION) {
			throw new UserFacingError(`${folder} was written by a newer version of the plugin. Update the plugin to open it.`);
		}

		const progressPath = joinPath(folder, PROGRESS_FILE);
		let progress: ProgressData = emptyProgress();
		if (await this.fs.exists(progressPath)) {
			const progressText = await this.fs.readText(progressPath);
			progress = { ...emptyProgress(), ...(JSON.parse(progressText) as ProgressData) };
			this.lastWritten.set(progressPath, progressText);
		}
		this.lastWritten.set(packagePath, packageText);

		data.renamedMedia ??= {};
		this.collection.setPackage({ folder, data, progress });
		return true;
	}

	/**
	 * Called when a file in the data folder changes on disk. Reloads the package
	 * if the change didn't come from this plugin (e.g. a sync from another device).
	 * Returns true when something was reloaded.
	 */
	async handleExternalChange(path: string): Promise<boolean> {
		const isPackageFile = path.endsWith(`/${PACKAGE_FILE}`) || path.endsWith(`/${PROGRESS_FILE}`);
		if (!isPackageFile || !path.startsWith(this.dataFolder() + "/")) return false;
		const folder = path.slice(0, path.lastIndexOf("/"));
		const owner = this.collection.allPackages().find((pkg) => pkg.folder === folder);
		// Unsaved local answers win over the incoming copy; they're written shortly.
		if (owner && this.progressSavers.has(owner.data.id)) return false;
		if (!(await this.fs.exists(path))) return false;
		const text = await this.fs.readText(path);
		if (this.lastWritten.get(path) === text) return false;
		return this.loadFolder(folder);
	}

	async importPackage(parsed: ParsedPackage, sourceName: string, onProgress: (progress: ImportProgress) => void): Promise<ImportReport> {
		const now = Date.now();
		const existing = this.findMatchingPackage(parsed);
		let pkg: LoadedPackage;
		let merge: MergeResult;

		if (existing) {
			pkg = existing;
			merge = mergeIntoPackage(pkg.data, parsed, now);
			pkg.data.source = sourceName;
		} else {
			const folder = await this.uniqueFolder(parsed.name);
			const data: PackageData = {
				schema: STORAGE_SCHEMA_VERSION,
				id: `p${now.toString(36)}`,
				name: parsed.name,
				source: sourceName,
				importedAt: now,
				updatedAt: now,
				noteTypes: parsed.noteTypes,
				decks: parsed.decks,
				notes: parsed.notes,
				cards: parsed.cards,
				renamedMedia: {},
			};
			pkg = { folder, data, progress: emptyProgress() };
			merge = { notesAdded: Object.keys(parsed.notes).length, notesUpdated: 0, cardsAdded: Object.keys(parsed.cards).length };
		}

		const mediaWritten = await this.writeMedia(pkg, parsed, onProgress);
		onProgress({ stage: "saving", done: 0, total: 1 });
		await this.savePackage(pkg);
		await this.saveProgress(pkg);
		this.collection.setPackage(pkg);
		onProgress({ stage: "saving", done: 1, total: 1 });

		return { ...merge, packageName: pkg.data.name, updatedExisting: Boolean(existing), mediaWritten };
	}

	/** Writes collection.json. Call after editing notes, cards or decks. */
	async savePackage(pkg: LoadedPackage): Promise<void> {
		await this.fs.mkdir(pkg.folder);
		await this.write(joinPath(pkg.folder, PACKAGE_FILE), JSON.stringify(pkg.data));
		this.collection.invalidate();
	}

	async saveProgress(pkg: LoadedPackage): Promise<void> {
		this.progressSavers.get(pkg.data.id)?.cancel();
		this.progressSavers.delete(pkg.data.id);
		await this.fs.mkdir(pkg.folder);
		await this.write(joinPath(pkg.folder, PROGRESS_FILE), JSON.stringify(pkg.progress));
	}

	/** Saves progress shortly after the last change, so a burst of answers is one write. */
	scheduleProgressSave(packageId: string): void {
		let saver = this.progressSavers.get(packageId);
		if (!saver) {
			saver = debounce(() => {
				const pkg = this.collection.getPackage(packageId);
				this.progressSavers.delete(packageId);
				if (pkg) void this.saveProgress(pkg).catch((error) => console.error("Flashcards: saving progress failed", error));
			}, PROGRESS_SAVE_DELAY_MS);
			this.progressSavers.set(packageId, saver);
		}
		saver();
	}

	/** Writes every pending progress change now (on unload or before leaving a session). */
	flush(): void {
		for (const saver of [...this.progressSavers.values()]) saver.flush();
	}

	async deletePackage(packageId: string): Promise<void> {
		const pkg = this.collection.getPackage(packageId);
		if (!pkg) return;
		this.progressSavers.get(packageId)?.cancel();
		this.progressSavers.delete(packageId);
		this.collection.removePackage(packageId);
		await this.fs.removeFolder(pkg.folder);
	}

	/** URL of a media file referenced by a card, or null when the name is empty. */
	mediaUrl(pkg: LoadedPackage, name: string): string | null {
		return name ? this.fs.resourceUrl(this.mediaPath(pkg, name)) : null;
	}

	/** Bytes of a media file, or null when the deck doesn't have it. */
	async readMedia(pkg: LoadedPackage, name: string): Promise<Uint8Array | null> {
		if (!name) return null;
		const path = this.mediaPath(pkg, name);
		if (!(await this.fs.exists(path))) return null;
		return this.fs.readBinary(path);
	}

	private mediaPath(pkg: LoadedPackage, name: string): string {
		return joinPath(pkg.folder, MEDIA_FOLDER, pkg.data.renamedMedia[name] ?? safeMediaName(name));
	}

	private findMatchingPackage(parsed: ParsedPackage): LoadedPackage | undefined {
		let best: LoadedPackage | undefined;
		let bestOverlap = 0;
		for (const pkg of this.collection.allPackages()) {
			const overlap = guidOverlap(pkg.data, parsed);
			if (overlap > bestOverlap) {
				best = pkg;
				bestOverlap = overlap;
			}
		}
		return best;
	}

	private async uniqueFolder(name: string): Promise<string> {
		const base = joinPath(this.dataFolder(), slugify(name));
		let folder = base;
		for (let n = 2; await this.fs.exists(folder); n++) folder = `${base} ${n}`;
		return folder;
	}

	private async writeMedia(pkg: LoadedPackage, parsed: ParsedPackage, onProgress: (progress: ImportProgress) => void): Promise<number> {
		const mediaFolder = joinPath(pkg.folder, MEDIA_FOLDER);
		await this.fs.mkdir(mediaFolder);
		const used = new Set(Object.values(pkg.data.renamedMedia));
		let written = 0;

		for (const [index, media] of parsed.media.entries()) {
			onProgress({ stage: "media", done: index, total: parsed.media.length });
			let stored = pkg.data.renamedMedia[media.name] ?? safeMediaName(media.name);
			if (stored !== media.name && !pkg.data.renamedMedia[media.name]) {
				// Two different names can sanitise to the same file name.
				for (let n = 2; used.has(stored); n++) stored = `${n}-${safeMediaName(media.name)}`;
				pkg.data.renamedMedia[media.name] = stored;
				used.add(stored);
			}
			const path = joinPath(mediaFolder, stored);
			if (await this.fs.exists(path)) continue;
			await this.fs.writeBinary(path, await media.read());
			written++;
		}
		onProgress({ stage: "media", done: parsed.media.length, total: parsed.media.length });
		return written;
	}

	private async write(path: string, text: string): Promise<void> {
		this.lastWritten.set(path, text);
		await this.fs.writeText(path, text);
	}
}

function emptyProgress(): ProgressData {
	return { schema: STORAGE_SCHEMA_VERSION, cards: {}, log: [] };
}
