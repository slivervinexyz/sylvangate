import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { type Hex, isHex } from "viem";

export function loadDotEnv(path = resolve(process.cwd(), ".env")): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

export function mergeEnv(fileEnv: Record<string, string>): Record<string, string> {
  return { ...fileEnv, ...(process.env as Record<string, string>) };
}

export function resolveOwnerPrivateKey(env: Record<string, string>): Hex {
  const candidates = [
    env.ZERODEV_OWNER_PRIVATE_KEY,
    env.ARB_SEPOLIA_PRIVATE_KEY,
    env.ARB_MAINNET_SESSION_PK,
    env.HL_TESTNET_PRIVATE_KEY,
  ];
  for (const raw of candidates) {
    if (raw && isHex(raw)) return raw;
  }
  throw new Error(
    "Missing funded owner key: set ZERODEV_OWNER_PRIVATE_KEY or ARB_SEPOLIA_PRIVATE_KEY in .env",
  );
}
