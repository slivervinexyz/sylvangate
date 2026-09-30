/** Gate telemetry broadcast private-key resolution (Sepolia + Mainnet). */
import { type Hex, isHex } from "viem";

export const SEPOLIA_BROADCAST_KEY_NAMES = [
  "PRIVATE_KEY",
  "ARB_SEPOLIA_PRIVATE_KEY",
  "WALLET_A_PK",
] as const;

export const MAINNET_BROADCAST_KEY_NAMES = [
  "MAINNET_PK",
  "WALLET_A_PK",
  "WALLET_A_PRIVATE_KEY",
  "WalletA_Pkey",
  "PRIVATE_KEY",
] as const;

export function normalizePrivateKey(raw: string): Hex | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return isHex(hex) && hex.length === 66 ? hex : null;
}

function resolveFromNames(env: Record<string, string>, names: readonly string[]): Hex {
  for (const name of names) {
    const raw = env[name];
    if (!raw) continue;
    const pk = normalizePrivateKey(raw);
    if (pk) return pk;
  }
  throw new Error(`[gate] broadcast key required: set one of ${names.join(", ")} in .env or env`);
}

export function resolveSepoliaBroadcastPrivateKey(env: Record<string, string>): Hex {
  return resolveFromNames(env, SEPOLIA_BROADCAST_KEY_NAMES);
}

export function resolveMainnetBroadcastPrivateKey(env: Record<string, string>): Hex {
  return resolveFromNames(env, MAINNET_BROADCAST_KEY_NAMES);
}

/** @deprecated Use resolveSepoliaBroadcastPrivateKey */
export const resolveBroadcastPrivateKey = resolveSepoliaBroadcastPrivateKey;
