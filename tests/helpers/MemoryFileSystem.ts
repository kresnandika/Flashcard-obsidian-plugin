import type { FileSystem } from "../../src/storage/FileSystem";

/** In-memory FileSystem for repository tests. */
export class MemoryFileSystem implements FileSystem {
	readonly files = new Map<string, string | Uint8Array>();
	readonly folders = new Set<string>();
	writes: string[] = [];

	async exists(path: string): Promise<boolean> {
		return this.files.has(path) || this.folders.has(path);
	}

	async readText(path: string): Promise<string> {
		const value = this.files.get(path);
		if (typeof value !== "string") throw new Error(`No text file at ${path}`);
		return value;
	}

	async writeText(path: string, text: string): Promise<void> {
		this.files.set(path, text);
		this.writes.push(path);
	}

	async writeBinary(path: string, data: Uint8Array): Promise<void> {
		this.files.set(path, data);
		this.writes.push(path);
	}

	async mkdir(path: string): Promise<void> {
		const parts = path.split("/");
		for (let i = 1; i <= parts.length; i++) this.folders.add(parts.slice(0, i).join("/"));
	}

	async listFolders(path: string): Promise<string[]> {
		const depth = path.split("/").length + 1;
		return [...this.folders].filter((folder) => folder.startsWith(path + "/") && folder.split("/").length === depth);
	}

	async removeFolder(path: string): Promise<void> {
		for (const key of [...this.files.keys()]) if (key.startsWith(path + "/")) this.files.delete(key);
		for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) this.folders.delete(folder);
	}

	resourceUrl(path: string): string {
		return `app://vault/${encodeURI(path)}`;
	}
}
