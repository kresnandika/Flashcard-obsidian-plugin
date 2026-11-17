import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { SqlJsStatic } from "sql.js";
import { loadSqlite } from "../../src/anki/sqlite";

const require = createRequire(import.meta.url);

/** sql.js with the same WebAssembly binary the plugin inlines. */
export function testSqlite(): Promise<SqlJsStatic> {
	return loadSqlite(new Uint8Array(readFileSync(require.resolve("sql.js/dist/sql-wasm.wasm"))));
}
