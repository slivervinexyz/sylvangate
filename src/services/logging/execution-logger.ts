/**
 * Persistent 7-day mainnet execution logger — B2B verification proof SSOT.
 * Appends structured records to `logs/mainnet-execution-7d.json`.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MAINNET_EXECUTION_LOG_PATH = join(
  __dirname,
  "../../../logs/mainnet-execution-7d.json",
);

export interface ExecutionLegFill {
  venue: "SPOT" | "PERP";
  side: "BUY" | "SHORT" | "SELL" | "LONG";
  oid?: number;
  avgPx?: number;
  totalSz?: number;
  notionalUsd?: number;
  status: string;
  /** HL L1 response fingerprint (exchange has no EVM tx hash) */
  responseHash?: string;
  rawStatus?: unknown;
}

export interface MainnetExecutionLogEntry {
  id: string;
  timestamp: string;
  mode: "DRY_RUN" | "LIVE";
  symbol: string;
  /** Unified Account available collateral USD at attempt */
  unifiedAvailableUsd: number;
  probeLatencyMs: number;
  probeBudgetMs: number;
  probeOk: boolean;
  midPx: number;
  fundingRateHourly: number;
  /** Estimated hourly funding yield on clip notional (USD) */
  fundingYieldUsdHourly: number;
  clipUsd: number;
  spotFill?: ExecutionLegFill;
  perpFill?: ExecutionLegFill;
  /** Mid → fill slippage (bps), absolute mean of legs when available */
  executionSlippageBps?: number;
  ok: boolean;
  error?: string;
  /** Cumulative net funding yield USD over retained 7d window (after append) */
  netCumulativeFundingYieldUsd?: number;
  /** HYPE staking discount ratio applied to rebalance friction (0–0.4) */
  stakedHypeDiscount?: number;
  /** Hyperliquid Native Earn USDC APY (hurdle rate) */
  nativeEarnApy?: number;
  /** targetNetApy − nativeEarnApy (grant reporting excess-yield metric) */
  excessYieldOverEarn?: number;
}

export interface MainnetExecutionLogFile {
  schemaVersion: 1;
  updatedAt: string;
  retentionMs: number;
  entries: MainnetExecutionLogEntry[];
  /** Rolling sum of fundingYieldUsdHourly over retained entries */
  netCumulativeFundingYieldUsd: number;
  /** Auto-compound snapshot (exponentialGrowthApy + history) */
  compounding?: {
    principalUsd: number;
    accruedUsd: number;
    lastFundingRateHourly: number;
    exponentialGrowthApy: number;
    history: Array<{
      timestamp: string;
      compoundedUsd: number;
      principalBeforeUsd: number;
      principalAfterUsd: number;
      exponentialGrowthApy: number;
      fundingRateHourly: number;
    }>;
    updatedAt: string;
  };
}

function emptyLog(): MainnetExecutionLogFile {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    retentionMs: SEVEN_DAYS_MS,
    entries: [],
    netCumulativeFundingYieldUsd: 0,
  };
}

function pruneOldEntries(
  entries: MainnetExecutionLogEntry[],
  nowMs = Date.now(),
): MainnetExecutionLogEntry[] {
  const cutoff = nowMs - SEVEN_DAYS_MS;
  return entries.filter((e) => {
    const t = Date.parse(e.timestamp);
    return Number.isFinite(t) && t >= cutoff;
  });
}

function sumFundingYield(entries: MainnetExecutionLogEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.fundingYieldUsdHourly || 0), 0);
}

export function loadMainnetExecutionLog(
  path = MAINNET_EXECUTION_LOG_PATH,
): MainnetExecutionLogFile {
  if (!existsSync(path)) return emptyLog();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as MainnetExecutionLogFile;
    const entries = pruneOldEntries(raw.entries ?? []);
    return {
      schemaVersion: 1,
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
      retentionMs: SEVEN_DAYS_MS,
      entries,
      netCumulativeFundingYieldUsd: sumFundingYield(entries),
      compounding: raw.compounding,
    };
  } catch {
    return emptyLog();
  }
}

export function hashExecutionPayload(payload: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex")
    .slice(0, 24)}`;
}

export function computeSlippageBps(
  midPx: number,
  fillPx: number,
  side: "BUY" | "SHORT",
): number {
  if (!(midPx > 0) || !(fillPx > 0)) return 0;
  const raw = ((fillPx - midPx) / midPx) * 10_000;
  // BUY pays above mid → positive adverse; SHORT sells below mid → positive adverse
  if (side === "BUY") return raw;
  return -raw;
}

/** Append one execution attempt; prunes to 7-day window; returns written entry. */
export function appendMainnetExecutionLog(
  partial: Omit<
    MainnetExecutionLogEntry,
    "id" | "netCumulativeFundingYieldUsd"
  > & { id?: string },
  path = MAINNET_EXECUTION_LOG_PATH,
): MainnetExecutionLogEntry {
  mkdirSync(dirname(path), { recursive: true });
  const log = loadMainnetExecutionLog(path);
  const entry: MainnetExecutionLogEntry = {
    ...partial,
    id:
      partial.id ??
      `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const entries = pruneOldEntries([...log.entries, entry]);
  const netCumulativeFundingYieldUsd = sumFundingYield(entries);
  entry.netCumulativeFundingYieldUsd = netCumulativeFundingYieldUsd;

  const next: MainnetExecutionLogFile = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    retentionMs: SEVEN_DAYS_MS,
    entries,
    netCumulativeFundingYieldUsd,
    compounding: log.compounding,
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return entry;
}
