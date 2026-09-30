import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";

export function hashAbiString(value: string): `0x${string}` {
  return `0x${bytesToHex(keccak_256(new TextEncoder().encode(value)))}`;
}
