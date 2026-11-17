import type { LoadedPackage } from "../../domain/types";
import { collectMediaReferences, toDataUri, type MediaResolver } from "../../rendering/media";
import type { PackageRepository } from "../../storage/PackageRepository";

const CACHE_LIMIT = 80;

/**
 * Loads the media a card side references and resolves it to data: URIs,
 * keeping the most recently used files in memory so flipping a card or
 * revisiting it doesn't read the vault again.
 */
export class MediaInliner {
	private readonly cache = new Map<string, string | null>();

	constructor(private readonly repository: PackageRepository) {}

	async resolverFor(pkg: LoadedPackage, html: string): Promise<MediaResolver> {
		const names = collectMediaReferences(html);
		await Promise.all(names.map((name) => this.load(pkg, name)));
		return (name) => this.cache.get(this.key(pkg, name)) ?? null;
	}

	/** Warms the cache for a card that's about to be shown. */
	prefetch(pkg: LoadedPackage, html: string): void {
		void this.resolverFor(pkg, html).catch(() => undefined);
	}

	clear(): void {
		this.cache.clear();
	}

	private async load(pkg: LoadedPackage, name: string): Promise<void> {
		const key = this.key(pkg, name);
		if (this.cache.has(key)) {
			const value = this.cache.get(key) ?? null;
			this.cache.delete(key);
			this.cache.set(key, value);
			return;
		}
		let uri: string | null = null;
		try {
			const bytes = await this.repository.readMedia(pkg, name);
			uri = bytes ? toDataUri(bytes, name) : null;
		} catch (error) {
			console.warn(`Flashcards: couldn't read media "${name}"`, error);
		}
		this.cache.set(key, uri);
		while (this.cache.size > CACHE_LIMIT) {
			const oldest = this.cache.keys().next().value;
			if (oldest === undefined) break;
			this.cache.delete(oldest);
		}
	}

	private key(pkg: LoadedPackage, name: string): string {
		return `${pkg.data.id}/${name}`;
	}
}
