/** Grant audit — provenance-verified live trades loader (Edge-safe static JSON, no fs). */
import type { GrantAuditPayload } from "./grant-audit.types";
import provenanceVerifiedTrades from "../../data/provenance_verified_trades.json";

export interface ProvenanceVerifiedHlTrade {
  oid: string;
  network: string;
  venue: string;
  symbol: string;
  side: string;
  sizeEth?: number;
  notionalUsd?: number;
  marginUsd?: number;
  executionMode?: string;
  dryRun: boolean;
  livePost: true;
  wallet: string;
  explorerUrl: string;
  hedgeTarget?: string;
  verification?: Record<string, unknown>;
}

export interface ProvenanceVerifiedGmxDeposit {
  network: string;
  venue: "gmx-v2";
  symbol: string;
  side: string;
  txHash: string;
  wallet?: string;
  explorerUrl: string;
  hedgeLeg?: string;
  verification?: Record<string, unknown>;
}

export type ProvenanceVerifiedTrade = ProvenanceVerifiedHlTrade | ProvenanceVerifiedGmxDeposit;

export interface ProvenanceVerifiedTrades {
  schema: string;
  recordedAt: string;
  trades: ProvenanceVerifiedTrade[];
  aggregate: {
    liveMainnetOrderCount: number;
    gmxArbitrumAnchorCount: number;
    testnetSuite: string;
    stub: boolean;
  };
}

let cachedProvenance: ProvenanceVerifiedTrades | null | undefined;

function isHlTrade(raw: unknown): raw is ProvenanceVerifiedHlTrade {
  if (!raw || typeof raw !== "object") return false;
  const t = raw as Partial<ProvenanceVerifiedHlTrade>;
  return t.livePost === true && typeof t.oid === "string" && /^\d+$/.test(t.oid);
}

function isGmxDeposit(raw: unknown): raw is ProvenanceVerifiedGmxDeposit {
  if (!raw || typeof raw !== "object") return false;
  const t = raw as Partial<ProvenanceVerifiedGmxDeposit>;
  return (
    typeof t.txHash === "string" &&
    /^0x[0-9a-f]{64}$/i.test(t.txHash) &&
    (t.venue === "gmx-v2" || t.network === "arbitrum-one")
  );
}

function parseProvenance(raw: unknown): ProvenanceVerifiedTrades | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<ProvenanceVerifiedTrades>;
  if (!Array.isArray(row.trades)) return null;
  const trades = row.trades.filter(
    (t): t is ProvenanceVerifiedTrade => isHlTrade(t) || isGmxDeposit(t),
  );
  if (trades.length === 0) return null;
  const hlCount = trades.filter((t) => "oid" in t).length;
  const gmxCount = trades.filter((t) => "txHash" in t).length;
  return {
    schema: String(row.schema ?? "silvervine.provenance-verified-trades.v1"),
    recordedAt: String(row.recordedAt ?? ""),
    trades,
    aggregate: {
      liveMainnetOrderCount: hlCount,
      gmxArbitrumAnchorCount: gmxCount,
      testnetSuite: String(row.aggregate?.testnetSuite ?? ""),
      stub: false,
    },
  };
}

export function loadProvenanceVerifiedTrades(force = false): ProvenanceVerifiedTrades | null {
  if (!force && cachedProvenance !== undefined) return cachedProvenance;
  cachedProvenance = parseProvenance(provenanceVerifiedTrades);
  return cachedProvenance;
}

export function attachProvenanceVerifiedTrades<T extends GrantAuditPayload>(
  payload: T,
): T & { provenanceVerified: ProvenanceVerifiedTrades | null } {
  return { ...payload, provenanceVerified: loadProvenanceVerifiedTrades() };
}

export function __resetProvenanceVerifiedCacheForTests(): void {
  cachedProvenance = undefined;
}
