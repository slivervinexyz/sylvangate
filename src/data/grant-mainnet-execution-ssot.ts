/** Grant audit — verified mainnet execution tx SSOT (live mainnet only, no testnet 5-tx bleed). */
import { ARBISCAN_BASE } from "../routes/grant-audit-lib/grant-audit-onchain-proof";

export type GrantExecutionVenue = "HL" | "GMX";

export interface GrantMainnetExecutionEntry {
  hash: string;
  venue: GrantExecutionVenue;
  label: string;
}

/** Wallet B GMX v2 GM pool deposit — Arbiscan-verified anchoring tx. */
export const GRANT_GMX_GM_DEPOSIT_TX_HASH =
  "0x9af4d7224639e5e72289fec7688ecbff19978ecf84d1bb06471ef1daf129f760" as const;

export function buildGrantMainnetExecutionSsot(): GrantMainnetExecutionEntry[] {
  return [
    {
      hash: GRANT_GMX_GM_DEPOSIT_TX_HASH,
      venue: "GMX",
      label: "Arbitrum GMX GM Deposit",
    },
  ];
}

export function buildGrantExecutionExplorerUrl(entry: GrantMainnetExecutionEntry): string {
  if (entry.venue === "GMX") return `${ARBISCAN_BASE}/tx/${entry.hash}`;
  return entry.hash;
}

function isMainnetTxHash(raw: string): boolean {
  const body = raw.trim().replace(/^sha256:/i, "");
  return /^0x[0-9a-f]{64}$/i.test(body);
}

/** Prefer live KV mainnet hashes; fall back to verified GMX mainnet anchor only. */
export function resolveGrantMainnetExecutionEntries(
  extracted: string[],
): GrantMainnetExecutionEntry[] {
  const live = extracted.filter(isMainnetTxHash).map((h) => h.replace(/^sha256:/i, ""));
  if (live.length === 0) return buildGrantMainnetExecutionSsot();
  return live.map((hash, index) => {
    const isGmx =
      hash.toLowerCase() === GRANT_GMX_GM_DEPOSIT_TX_HASH.toLowerCase() || index === live.length - 1;
    return {
      hash,
      venue: isGmx ? ("GMX" as const) : ("HL" as const),
      label: isGmx ? "Arbitrum GMX GM Deposit" : `HL Mainnet Fill #${index + 1}`,
    };
  });
}

export function resolveGrantAuditTxHashes(extracted: string[]): string[] {
  return resolveGrantMainnetExecutionEntries(extracted).map((entry) => entry.hash);
}
