// The sql.js WebAssembly binary, inlined into main.js by esbuild's binary
// loader (see esbuild.config.mjs) so imports work offline and on mobile.
import wasm from "sql.js/dist/sql-wasm.wasm";

export const SQLITE_WASM: Uint8Array = wasm;
