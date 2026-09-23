/** Grant audit — block proof core helpers (hash normalize · funding epoch). */
import {
  FUNDING_EPOCH_POST_LOCK_SEC,
  FUNDING_EPOCH_PRE_LOCK_SEC,
} from "../../services/risk/soil-protection";

export const THUNDERHEAD_TX_EXPLORER_BASE =
  "https://stats.hyperliquid.xyz/tx/" as const;

const MS_PER_HOUR = 3_600_000;
const MS_PER_SEC = 1_000;

export interface GrantAuditBlockProofs {
  l1BlockHash: string | null;
  fundingEpochBlockHeight: number | null;
  makerVolumeShare: number | null;
  thunderheadAuditUrl: string | null;
}

export function normalizeHlTxHash(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^sha256:/i, "");
  const body = stripped.startsWith("0x") ? stripped.slice(2) : stripped;
  if (!/^[0-9a-f]{64}$/i.test(body)) return null;
  return `0x${body.toLowerCase()}`;
}

export function buildThunderheadAuditUrl(rawHash: string): string | null {
  const hash = normalizeHlTxHash(rawHash);
  if (!hash) return null;
  return `${THUNDERHEAD_TX_EXPLORER_BASE}${hash}`;
}

export function isFundingEpochMs(timeMs: number): boolean {
  const msIntoHour = ((timeMs % MS_PER_HOUR) + MS_PER_HOUR) % MS_PER_HOUR;
  const preLockStartMs = MS_PER_HOUR - FUNDING_EPOCH_PRE_LOCK_SEC * MS_PER_SEC;
  const postLockEndMs = FUNDING_EPOCH_POST_LOCK_SEC * MS_PER_SEC;
  return msIntoHour >= preLockStartMs || msIntoHour < postLockEndMs;
}

export function extractStoredBlockProofs(
  entries: unknown[],
  latest: unknown,
): Partial<GrantAuditBlockProofs> {
  const rows = [...entries];
  if (latest && typeof latest === "object") rows.push(latest);

  let l1BlockHash: string | null = null;
  let fundingEpochBlockHeight: number | null = null;
  let makerVolumeShare: number | null = null;

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!l1BlockHash && typeof r.l1BlockHash === "string") {
      l1BlockHash = r.l1BlockHash;
    }
    const epochHeight = Number(r.fundingEpochBlockHeight);
    if (fundingEpochBlockHeight == null && Number.isFinite(epochHeight)) {
      fundingEpochBlockHeight = epochHeight;
    }
    const storedShare = Number(r.makerVolumeShare);
    if (makerVolumeShare == null && Number.isFinite(storedShare)) {
      makerVolumeShare = storedShare;
    }
  }

  return { l1BlockHash, fundingEpochBlockHeight, makerVolumeShare };
}
