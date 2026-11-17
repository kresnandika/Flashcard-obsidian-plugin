import { normalizePath, type DataAdapter } from "obsidian";
import type { FileSystem } from "./FileSystem";

/** FileSystem backed by the vault adapter, so data lives in (and syncs with) the vault. */
export class ObsidianFileSystem implements FileSystem {
	constructor(private readonly adapter: DataAdapter) {}

	exists(path: string): Promise<boolean> {
		return this.adapter.exists(normalizePath(path));
	}

	readText(path: string): Promise<string> {
		return this.adapter.read(normalizePath(path));
	}

	async readBinary(path: string): Promise<Uint8Array> {
		return new Uint8Array(await this.adapter.readBinary(normalizePath(path)));
	}

	writeText(path: string, text: string): Promise<void> {
		return this.adapter.write(normalizePath(path), text);
	}

	writeBinary(path: string, data: Uint8Array): Promise<void> {
		const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
		return this.adapter.writeBinary(normalizePath(path), buffer);
	}

	async mkdir(path: string): Promise<void> {
		const parts = normalizePath(path).split("/");
		for (let i = 1; i <= parts.length; i++) {
			const partial = parts.slice(0, i).join("/");
			if (!(await this.adapter.exists(partial))) await this.adapter.mkdir(partial);
		}
	}

	async listFolders(path: string): Promise<string[]> {
		const normalized = normalizePath(path);
		if (!(await this.adapter.exists(normalized))) return [];
		return (await this.adapter.list(normalized)).folders;
	}

	removeFolder(path: string): Promise<void> {
		return this.adapter.rmdir(normalizePath(path), true);
	}

	resourceUrl(path: string): string {
		return this.adapter.getResourcePath(normalizePath(path));
	}
}
