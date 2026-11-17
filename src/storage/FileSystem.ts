/**
 * The file operations the repository needs. Obsidian's adapter implements it
 * in the plugin (ObsidianFileSystem); tests use an in-memory version.
 */
export interface FileSystem {
	exists(path: string): Promise<boolean>;
	readText(path: string): Promise<string>;
	readBinary(path: string): Promise<Uint8Array>;
	writeText(path: string, text: string): Promise<void>;
	writeBinary(path: string, data: Uint8Array): Promise<void>;
	/** Creates the folder and any missing parents. */
	mkdir(path: string): Promise<void>;
	/** Full paths of the folders directly inside `path`; empty if it doesn't exist. */
	listFolders(path: string): Promise<string[]>;
	removeFolder(path: string): Promise<void>;
	/** A URL that can load the file in a web view (e.g. an `app://` URL on desktop). */
	resourceUrl(path: string): string;
}

export function joinPath(...parts: string[]): string {
	return parts
		.filter((part) => part !== "")
		.join("/")
		.replace(/\/+/g, "/")
		.replace(/^\/|\/$/g, "");
}
