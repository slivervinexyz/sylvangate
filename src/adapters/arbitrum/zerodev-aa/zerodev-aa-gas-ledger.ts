/** ZeroDev AA sponsored gas ledger — memory-first, optional KV persistence (24h rolling window). */

export const MAX_GAS_COST_PER_USEROP_USD = 0.5 as const;
export const DAILY_SPONSORSHIP_LIMIT_USD = 10 as const;
export const GAS_LEDGER_WINDOW_MS = 86_400_000 as const;
export const GAS_LEDGER_KV_KEY = "zerodev:aa:gas:ledger" as const;
export const GAS_LEDGER_KV_TTL_SEC = 86_400 as const;

export interface GasLedgerSnapshot {
  windowStartMs: number;
  cumulativeSpentUsd: number;
  lastUpdatedMs: number;
}

export interface PerUserOpGasLimitVerdict {
  exceeded: boolean;
  estimatedGasCostUsd?: number;
  maxAllowedUsd: typeof MAX_GAS_COST_PER_USEROP_USD;
}

export interface DailySponsorshipVerdict {
  exhausted: boolean;
  cumulativeSpentUsd: number;
  limitUsd: typeof DAILY_SPONSORSHIP_LIMIT_USD;
  sponsored: boolean;
  gasGuardReason?: string;
}

export interface SponsoredGasLimitVerdict {
  perUserOp: PerUserOpGasLimitVerdict;
  daily: DailySponsorshipVerdict;
  sponsored: boolean;
  dailySpentUsd: number;
  gasGuardReason?: string;
}

let memoryLedger: GasLedgerSnapshot = freshSnapshot(Date.now());

export function __resetGasLedgerForTests(nowMs = Date.now()): void {
  memoryLedger = freshSnapshot(nowMs);
}

export function __setGasLedgerForTests(snapshot: GasLedgerSnapshot): void {
  memoryLedger = snapshot;
}

function freshSnapshot(nowMs: number): GasLedgerSnapshot {
  return { windowStartMs: nowMs, cumulativeSpentUsd: 0, lastUpdatedMs: nowMs };
}

export function normalizeGasLedgerSnapshot(raw: GasLedgerSnapshot, nowMs: number): GasLedgerSnapshot {
  if (!Number.isFinite(raw.windowStartMs) || !Number.isFinite(raw.cumulativeSpentUsd)) {
    return freshSnapshot(nowMs);
  }
  if (nowMs - raw.windowStartMs >= GAS_LEDGER_WINDOW_MS) {
    return freshSnapshot(nowMs);
  }
  return {
    windowStartMs: raw.windowStartMs,
    cumulativeSpentUsd: Math.max(0, raw.cumulativeSpentUsd),
    lastUpdatedMs: nowMs,
  };
}

export function getGasLedgerSnapshot(nowMs = Date.now()): GasLedgerSnapshot {
  memoryLedger = normalizeGasLedgerSnapshot(memoryLedger, nowMs);
  return memoryLedger;
}

export async function loadGasLedgerFromKv(kv: KVNamespace, nowMs = Date.now()): Promise<GasLedgerSnapshot> {
  try {
    const raw = await kv.get(GAS_LEDGER_KV_KEY);
    if (!raw) {
      memoryLedger = getGasLedgerSnapshot(nowMs);
      return memoryLedger;
    }
    try {
      const parsed = JSON.parse(raw) as GasLedgerSnapshot;
      memoryLedger = normalizeGasLedgerSnapshot(parsed, nowMs);
    } catch {
      memoryLedger = getGasLedgerSnapshot(nowMs);
    }
  } catch {
    memoryLedger = getGasLedgerSnapshot(nowMs);
  }
  return memoryLedger;
}

/** Pure per-UserOp hard cap — caller decides whether to throw. */
export function evaluatePerUserOpGasLimit(estimatedGasCostUsd?: number): PerUserOpGasLimitVerdict {
  const finite = estimatedGasCostUsd !== undefined && Number.isFinite(estimatedGasCostUsd);
  return {
    exceeded: finite && estimatedGasCostUsd > MAX_GAS_COST_PER_USEROP_USD,
    estimatedGasCostUsd: finite ? estimatedGasCostUsd : undefined,
    maxAllowedUsd: MAX_GAS_COST_PER_USEROP_USD,
  };
}

/** Pure daily soft-limit — fail-open to unsponsored, never throws. */
export function evaluateDailySponsorshipLimit(
  snapshot: GasLedgerSnapshot,
  requestedSponsorship: boolean,
  nowMs = Date.now(),
): DailySponsorshipVerdict {
  const normalized = normalizeGasLedgerSnapshot(snapshot, nowMs);
  const exhausted = normalized.cumulativeSpentUsd >= DAILY_SPONSORSHIP_LIMIT_USD;
  if (requestedSponsorship && exhausted) {
    return {
      exhausted: true,
      cumulativeSpentUsd: normalized.cumulativeSpentUsd,
      limitUsd: DAILY_SPONSORSHIP_LIMIT_USD,
      sponsored: false,
      gasGuardReason: `ZERODEV_DAILY_SPONSORSHIP_EXHAUSTED:${normalized.cumulativeSpentUsd.toFixed(4)}>=${DAILY_SPONSORSHIP_LIMIT_USD}`,
    };
  }
  return {
    exhausted,
    cumulativeSpentUsd: normalized.cumulativeSpentUsd,
    limitUsd: DAILY_SPONSORSHIP_LIMIT_USD,
    sponsored: requestedSponsorship,
  };
}

/** Stateless gas guard evaluation — no I/O, no mutation. */
export function evaluateSponsoredGasLimits(input: {
  estimatedGasCostUsd?: number;
  requestedSponsorship?: boolean;
  snapshot: GasLedgerSnapshot;
  nowMs?: number;
}): SponsoredGasLimitVerdict {
  const nowMs = input.nowMs ?? Date.now();
  const requested = input.requestedSponsorship === true;
  const perUserOp = evaluatePerUserOpGasLimit(input.estimatedGasCostUsd);
  const daily = evaluateDailySponsorshipLimit(input.snapshot, requested, nowMs);
  return {
    perUserOp,
    daily,
    sponsored: daily.sponsored && !perUserOp.exceeded,
    dailySpentUsd: daily.cumulativeSpentUsd,
    gasGuardReason: daily.gasGuardReason,
  };
}

export function recordSponsoredGasSpend(usd: number, nowMs = Date.now()): GasLedgerSnapshot {
  if (!Number.isFinite(usd) || usd <= 0) return getGasLedgerSnapshot(nowMs);
  const snap = getGasLedgerSnapshot(nowMs);
  memoryLedger = {
    windowStartMs: snap.windowStartMs,
    cumulativeSpentUsd: snap.cumulativeSpentUsd + usd,
    lastUpdatedMs: nowMs,
  };
  return memoryLedger;
}

export async function persistGasLedgerToKv(kv: KVNamespace, snapshot?: GasLedgerSnapshot): Promise<void> {
  const snap = snapshot ?? getGasLedgerSnapshot();
  await kv.put(GAS_LEDGER_KV_KEY, JSON.stringify(snap), { expirationTtl: GAS_LEDGER_KV_TTL_SEC });
}

export async function recordSponsoredGasSpendKv(
  usd: number,
  kv: KVNamespace,
  nowMs = Date.now(),
): Promise<GasLedgerSnapshot> {
  try {
    await loadGasLedgerFromKv(kv, nowMs);
  } catch {
    getGasLedgerSnapshot(nowMs);
  }
  const updated = recordSponsoredGasSpend(usd, nowMs);
  await persistGasLedgerToKv(kv, updated);
  return updated;
}
