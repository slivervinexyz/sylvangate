/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * @slivervine/exomesh-agentic-wallet-guard — Robinhood Chain audit cut-off snapshot export.
 */
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { AML_INBOUND_TO_ROBINHOOD_BLOCKED } from "../adapters/across-ingress-bridge";
import {
  ARBITRUM_ONE_CHAIN_ID,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "./constants";
import { assertUnidirectionalBridge } from "./unidirectional-bridge";

export type RobinhoodAuditChainId =
  | typeof ROBINHOOD_TESTNET_CHAIN_ID
  | typeof ROBINHOOD_MAINNET_CHAIN_ID;

export interface RobinhoodAuditSnapshotInput {
  robinhoodChainId?: RobinhoodAuditChainId;
  amountUsd?: number;
  wallet?: string;
  initiatedAtMs?: number;
  nowMs?: number;
  settledAtMs?: number | null;
  cutoffTimestamp?: string;
}

export interface RobinhoodAuditSnapshot {
  protocol: "SliverVineExoMesh";
  robinhoodChainId: RobinhoodAuditChainId;
  /** Chain 4663 mainnet inbound AML filter — always active at protocol layer. */
  mainnetFilterActive: true;
  inboundBlocked: true;
  inFlightCapitalUsd: number;
  settledCapitalUsd: number;
  lostUsd: 0;
  inboundToRobinhoodPermitted: false;
  capitalLabel: string;
  cutoffTimestamp: string;
  cutoffTimestampUnix: number;
  sha256Signature: string;
}

const DEFAULT_WALLET = "0x0000000000000000000000000000000000000000" as const;

function digestSha256Hex(canonical: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

function resolveRobinhoodChainId(
  chainId: number | undefined,
): RobinhoodAuditChainId {
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) return ROBINHOOD_MAINNET_CHAIN_ID;
  return ROBINHOOD_TESTNET_CHAIN_ID;
}

/** Build immutable Robinhood Chain audit certificate (SHA-256 signed). */
export function buildRobinhoodAuditSnapshot(
  input: RobinhoodAuditSnapshotInput = {},
): RobinhoodAuditSnapshot {
  const robinhoodChainId = resolveRobinhoodChainId(input.robinhoodChainId);
  const nowMs = input.nowMs ?? Date.now();
  const cutoffTimestamp = input.cutoffTimestamp ?? new Date(nowMs).toISOString();
  const cutoffTimestampUnix = Math.floor(new Date(cutoffTimestamp).getTime() / 1000);
  const wallet = input.wallet ?? DEFAULT_WALLET;
  const amountUsd = Math.max(0, input.amountUsd ?? 0);
  const initiatedAtMs = input.initiatedAtMs ?? nowMs;
  const probeUsd = amountUsd > 0 ? amountUsd : 1;

  const inbound = assertUnidirectionalBridge({
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    destChainId: robinhoodChainId,
    amountUsd: probeUsd,
    wallet,
    initiatedAtMs,
    nowMs,
  });
  if (
    inbound.ok ||
    inbound.capitalLabel !== AML_INBOUND_TO_ROBINHOOD_BLOCKED ||
    !inbound.reasons.includes(AML_INBOUND_TO_ROBINHOOD_BLOCKED)
  ) {
    throw new Error("ROBINHOOD_AUDIT_INVARIANT:inboundBlocked");
  }

  const outbound = assertUnidirectionalBridge({
    sourceChainId: robinhoodChainId,
    destChainId: ARBITRUM_ONE_CHAIN_ID,
    amountUsd,
    wallet,
    initiatedAtMs,
    nowMs,
    settledAtMs: input.settledAtMs,
  });

  if (outbound.lostUsd !== 0) {
    throw new Error("ROBINHOOD_AUDIT_INVARIANT:lostUsd");
  }

  const unsigned = {
    protocol: "SliverVineExoMesh" as const,
    robinhoodChainId,
    mainnetFilterActive: true as const,
    inboundBlocked: true as const,
    inFlightCapitalUsd: outbound.inFlightUsd,
    settledCapitalUsd: outbound.settledUsd,
    lostUsd: 0 as const,
    inboundToRobinhoodPermitted: false as const,
    capitalLabel: outbound.capitalLabel,
    cutoffTimestamp,
    cutoffTimestampUnix,
  };

  const canonical = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  return { ...unsigned, sha256Signature: digestSha256Hex(canonical) };
}

/** Export Robinhood audit snapshot; triggers browser download when `document` is available. */
export async function exportRobinhoodAuditSnapshot(
  input: RobinhoodAuditSnapshotInput = {},
): Promise<RobinhoodAuditSnapshot> {
  const snapshot = buildRobinhoodAuditSnapshot(input);
  if (typeof document !== "undefined") {
    const filename = `Robinhood-Audit-Snapshot-${snapshot.cutoffTimestampUnix}.json`;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return snapshot;
}

/** UTC calendar date label — `YYYY-MM-DD`. */
export function formatDailyUtcDate(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** UTC midnight cutoff for the report day — `YYYY-MM-DDT00:00:00.000Z`. */
export function formatDailyUtcCutoff(nowMs: number): string {
  return `${formatDailyUtcDate(nowMs)}T00:00:00.000Z`;
}

export interface DailyRobinhoodComplianceReport {
  reportType: "daily-robinhood-compliance";
  reportDateUtc: string;
  generatedAtUtc: string;
  snapshot: RobinhoodAuditSnapshot;
}

/** Daily compliance wrapper — binds `buildRobinhoodAuditSnapshot()` to UTC day cutoff. */
export async function exportDailyRobinhoodComplianceReport(
  input: RobinhoodAuditSnapshotInput = {},
): Promise<DailyRobinhoodComplianceReport> {
  const nowMs = input.nowMs ?? Date.now();
  const reportDateUtc = formatDailyUtcDate(nowMs);
  const cutoffTimestamp = formatDailyUtcCutoff(nowMs);
  const snapshot = buildRobinhoodAuditSnapshot({ ...input, nowMs, cutoffTimestamp });
  const report: DailyRobinhoodComplianceReport = {
    reportType: "daily-robinhood-compliance",
    reportDateUtc,
    generatedAtUtc: new Date(nowMs).toISOString(),
    snapshot,
  };
  if (typeof document !== "undefined") {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Robinhood-Daily-Compliance-${reportDateUtc}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return report;
}
