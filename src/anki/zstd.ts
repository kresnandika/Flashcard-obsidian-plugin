import { decompress } from "fzstd";

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

export function isZstd(bytes: Uint8Array): boolean {
	return ZSTD_MAGIC.every((byte, index) => bytes[index] === byte);
}

/** Decompresses zstd data; anything else is returned unchanged. */
export function maybeDecompress(bytes: Uint8Array): Uint8Array {
	return isZstd(bytes) ? decompress(bytes) : bytes;
}
