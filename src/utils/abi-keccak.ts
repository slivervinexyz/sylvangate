/** Lean ABI encode + keccak256 — viem SSOT (dedupe @noble/hashes vs standalone import). */
import { keccak256 } from "viem";

function pad32(bytes: Uint8Array): Uint8Array {
  const rem = bytes.length % 32;
  if (rem === 0) return bytes;
  const out = new Uint8Array(bytes.length + (32 - rem));
  out.set(bytes);
  return out;
}

function writeUint256Word(value: bigint, into: Uint8Array, at: number): void {
  for (let i = 31; i >= 0; i -= 1) {
    into[at + i] = Number(value & 0xffn);
    value >>= 8n;
  }
}

function encodeAbiString(value: string): Uint8Array {
  const raw = new TextEncoder().encode(value);
  const body = pad32(raw);
  const out = new Uint8Array(64 + body.length);
  writeUint256Word(32n, out, 0);
  writeUint256Word(BigInt(raw.length), out, 32);
  out.set(body, 64);
  return out;
}

function encodeBytes32(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length !== 64) throw new Error("bytes32 hex required");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function encodeAddress(addr: string): Uint8Array {
  const h = addr.startsWith("0x") ? addr.slice(2) : addr;
  if (h.length !== 40) throw new Error("address hex required");
  const out = new Uint8Array(32);
  for (let i = 0; i < 20; i += 1) {
    out[12 + i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function hashAbiString(value: string): `0x${string}` {
  return keccak256(encodeAbiString(value));
}

export function hashAbiTuple(types: string[], values: unknown[]): `0x${string}` {
  const words: Uint8Array[] = [];
  for (let i = 0; i < types.length; i += 1) {
    const t = types[i]!;
    const v = values[i];
    if (t === "bytes32") words.push(encodeBytes32(String(v)));
    else if (t === "address") words.push(encodeAddress(String(v)));
    else throw new Error(`unsupported abi type: ${t}`);
  }
  const total = words.length * 32;
  const packed = new Uint8Array(total);
  for (let i = 0; i < words.length; i += 1) {
    packed.set(words[i]!, i * 32);
  }
  return keccak256(packed);
}
