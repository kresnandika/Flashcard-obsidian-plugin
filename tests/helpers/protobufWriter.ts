/** Tiny protobuf encoder used only to build modern Anki fixtures in tests. */
export type Field = [field: number, value: number | string | Uint8Array];

export function encode(fields: Field[]): Uint8Array {
	const bytes: number[] = [];
	const varint = (value: number) => {
		let v = value;
		while (v >= 0x80) {
			bytes.push((v % 0x80) | 0x80);
			v = Math.floor(v / 0x80);
		}
		bytes.push(v);
	};
	for (const [field, value] of fields) {
		if (typeof value === "number") {
			varint(field * 8);
			varint(value);
		} else {
			const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
			varint(field * 8 + 2);
			varint(data.length);
			bytes.push(...data);
		}
	}
	return new Uint8Array(bytes);
}
