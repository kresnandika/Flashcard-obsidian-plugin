/**
 * Minimal protobuf wire-format reader, enough for the few messages in modern
 * Anki packages (package metadata, media list, note type and template config).
 */

export type ProtoValue = number | Uint8Array;

export class ProtoMessage {
	private constructor(private readonly fields: Map<number, ProtoValue[]>) {}

	static decode(bytes: Uint8Array): ProtoMessage {
		const fields = new Map<number, ProtoValue[]>();
		let offset = 0;
		const readVarint = (): number => {
			let result = 0;
			let shift = 0;
			while (offset < bytes.length) {
				const byte = bytes[offset++];
				result += (byte & 0x7f) * 2 ** shift;
				if ((byte & 0x80) === 0) return result;
				shift += 7;
			}
			throw new Error("Truncated protobuf varint");
		};

		while (offset < bytes.length) {
			const tag = readVarint();
			const field = Math.floor(tag / 8);
			const wireType = tag & 7;
			let value: ProtoValue;
			switch (wireType) {
				case 0:
					value = readVarint();
					break;
				case 1:
					value = bytes.subarray(offset, offset + 8);
					offset += 8;
					break;
				case 2: {
					const length = readVarint();
					value = bytes.subarray(offset, offset + length);
					offset += length;
					break;
				}
				case 5:
					value = bytes.subarray(offset, offset + 4);
					offset += 4;
					break;
				default:
					throw new Error(`Unsupported protobuf wire type ${wireType}`);
			}
			if (offset > bytes.length) throw new Error("Truncated protobuf message");
			const list = fields.get(field);
			if (list) list.push(value);
			else fields.set(field, [value]);
		}
		return new ProtoMessage(fields);
	}

	number(field: number, fallback = 0): number {
		const value = this.fields.get(field)?.[0];
		return typeof value === "number" ? value : fallback;
	}

	string(field: number, fallback = ""): string {
		const value = this.fields.get(field)?.[0];
		return value instanceof Uint8Array ? new TextDecoder().decode(value) : fallback;
	}

	messages(field: number): ProtoMessage[] {
		return (this.fields.get(field) ?? []).filter((value): value is Uint8Array => value instanceof Uint8Array).map((value) => ProtoMessage.decode(value));
	}

	has(field: number): boolean {
		return this.fields.has(field);
	}
}
