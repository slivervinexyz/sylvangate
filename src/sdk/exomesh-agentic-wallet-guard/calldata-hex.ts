/**
 * SPDX-License-Identifier: Apache-2.0
 * Hex calldata decode + ABI word readers — module-load scratch (zero per-RPC alloc).
 */

/** Module-load reusable calldata byte scratch (max 1 KiB per tx). */
export const CALLDATA_SCRATCH = new Uint8Array(1024);
const HEX_NIBBLE = new Uint8Array(256);
const HEX_CHAR = new Uint8Array(16);
/** Reusable `0x` + 40 lowercase hex chars (42 bytes) — single final string alloc per read. */
const ADDR_HEX_SCRATCH = new Uint8Array(42);

for (let i = 0; i < 10; i += 1) HEX_NIBBLE[48 + i] = i;
for (let i = 0; i < 6; i += 1) {
  HEX_NIBBLE[97 + i] = 10 + i;
  HEX_NIBBLE[65 + i] = 10 + i;
}
for (let i = 0; i < 10; i += 1) HEX_CHAR[i] = 48 + i;
for (let i = 0; i < 6; i += 1) HEX_CHAR[10 + i] = 97 + i;
ADDR_HEX_SCRATCH[0] = 0x30;
ADDR_HEX_SCRATCH[1] = 0x78;

export function decodeHexCalldata(data: string, out: Uint8Array): number {
  const raw = data.trim();
  let start = 0;
  if (raw.startsWith("0x") || raw.startsWith("0X")) start = 2;
  const hexLen = raw.length - start;
  const byteLen = hexLen >> 1;
  const limit = Math.min(byteLen, out.length);
  for (let i = 0; i < limit; i += 1) {
    const hi = HEX_NIBBLE[raw.charCodeAt(start + i * 2)] ?? 0;
    const lo = HEX_NIBBLE[raw.charCodeAt(start + i * 2 + 1)] ?? 0;
    out[i] = (hi << 4) | lo;
  }
  if (limit < out.length) out.fill(0, limit);
  return limit;
}

/** Read 4-byte selector as u32 (big-endian) — multiply avoids signed <<24 overflow (e.g. 0x9cc233d6). */
export function readSelectorU32(bytes: Uint8Array, byteLen: number): number {
  if (byteLen < 4) return 0;
  return (
    ((bytes[0]! & 0xff) * 0x1_000_000 +
      (bytes[1]! & 0xff) * 0x1_0000 +
      (bytes[2]! & 0xff) * 0x100 +
      (bytes[3]! & 0xff)) >>> 0
  );
}

export function readAddressAt(bytes: Uint8Array, byteOffset: number): string {
  const start = byteOffset + 12;
  for (let i = 0; i < 20; i += 1) {
    const b = bytes[start + i]! & 0xff;
    const o = 2 + i * 2;
    ADDR_HEX_SCRATCH[o] = HEX_CHAR[b >> 4]!;
    ADDR_HEX_SCRATCH[o + 1] = HEX_CHAR[b & 0x0f]!;
  }
  return String.fromCharCode(...ADDR_HEX_SCRATCH);
}

export function readUint256At(bytes: Uint8Array, byteOffset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 32; i += 1) v = (v << 8n) | BigInt(bytes[byteOffset + i]! & 0xff);
  return v;
}

export function readUint160At(bytes: Uint8Array, byteOffset: number): bigint {
  let v = 0n;
  for (let i = 12; i < 32; i += 1) v = (v << 8n) | BigInt(bytes[byteOffset + i]! & 0xff);
  return v;
}

export function readWordU32(bytes: Uint8Array, byteOffset: number, byteLen: number): number {
  if (byteOffset + 32 > byteLen) return 0;
  const word = readUint256At(bytes, byteOffset);
  return word <= 0xffffn ? Number(word) : 0;
}
