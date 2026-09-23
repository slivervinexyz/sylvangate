/** HL testnet private key resolution — no hardcoded known test vectors in source. */
import { createHash } from "node:crypto";

const DRY_RUN_SEED = "silvervine:hl-testnet:dry-run:v1";

let cachedDryRunKey: string | undefined;

/** Deterministic dry-run placeholder derived at runtime — not a published test key. */
export function resolveHlTestnetDryRunPrivateKey(): string {
  if (!cachedDryRunKey) {
    cachedDryRunKey = `0x${createHash("sha256").update(DRY_RUN_SEED).digest("hex")}`;
  }
  return cachedDryRunKey;
}

export function resolveHlTestnetPrivateKey(override?: string): string {
  const fromEnv = override?.trim() || process.env.HL_TESTNET_PRIVATE_KEY?.trim();
  if (fromEnv) return fromEnv;
  return resolveHlTestnetDryRunPrivateKey();
}

export function isFundedHlTestnetPrivateKey(privateKey: string): boolean {
  return privateKey !== resolveHlTestnetDryRunPrivateKey();
}
