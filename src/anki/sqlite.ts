import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";

let engine: Promise<SqlJsStatic> | null = null;

/**
 * Loads sql.js once. The WebAssembly binary is passed in rather than fetched,
 * so the plugin works offline and on mobile (it's inlined into main.js).
 */
export function loadSqlite(wasmBinary: Uint8Array): Promise<SqlJsStatic> {
	if (!engine) {
		engine = initSqlJs({ wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer });
		engine.catch(() => (engine = null));
	}
	return engine;
}

export type Row = Record<string, SqlValue>;

export function queryAll(db: Database, sql: string): Row[] {
	const statement = db.prepare(sql);
	try {
		const rows: Row[] = [];
		while (statement.step()) rows.push(statement.getAsObject());
		return rows;
	} finally {
		statement.free();
	}
}

export function tableExists(db: Database, table: string): boolean {
	return queryAll(db, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table.replace(/'/g, "''")}'`).length > 0;
}

export function asString(value: SqlValue): string {
	if (value === null || value === undefined) return "";
	if (value instanceof Uint8Array) return new TextDecoder().decode(value);
	return String(value);
}

export function asNumber(value: SqlValue): number {
	return typeof value === "number" ? value : Number(value ?? 0);
}

export function asBytes(value: SqlValue): Uint8Array {
	if (value instanceof Uint8Array) return value;
	return new TextEncoder().encode(asString(value));
}
