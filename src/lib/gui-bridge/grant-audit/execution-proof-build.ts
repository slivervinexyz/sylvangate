import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import verifiedResults from "../../../data/verified_5tx_results.json";
import type { FullGrantAuditVenueView, GrantAuditExecution } from "./grant-audit-view-types";

export interface ExecutionProofDetails {
  sha256Anchor: string;
  venueLabel: string;
  fillPriceUsd: number;
  slippageSavedUsd: number;
  slippageSavedBps: number;
  executionLatencyMs: number;
  proofJson: Record<string, unknown>;
}

function hashProofBody(body: Record<string, unknown>): string {
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

function resolveVenueLabel(venue: string): string {
  return venue === "GMX" ? "GMX v2 GM Pool" : "Hyperliquid Perp Leg B";
}

export function buildExecutionProofDetails(
  exec: GrantAuditExecution,
  view: FullGrantAuditVenueView,
): ExecutionProofDetails {
  const verifiedFill = verifiedResults.fills.find(
    (fill) => fill.txHash.toLowerCase() === exec.hash.toLowerCase(),
  );
  const slippageSavedUsd =
    verifiedFill?.savedUsd ??
    Number((view.slippageSavedUsd / Math.max(view.executions.length, 1)).toFixed(4));
  const slippageSavedBps = verifiedFill
    ? Number((verifiedFill.rawSlippageBps - verifiedFill.gatedSlippageBps).toFixed(2))
    : view.slippageSavedBps;
  const executionLatencyMs = exec.venue === "GMX" ? view.arbitrumRpcMs : view.hlSessionWsMs;
  const unsigned = {
    action: exec.action,
    venue: exec.venue,
    venueLabel: resolveVenueLabel(exec.venue),
    hash: exec.hash,
    explorerUrl: exec.explorerUrl,
    amountUsd: exec.amountUsd,
    fillPriceUsd: exec.amountUsd,
    slippageSavedUsd,
    slippageSavedBps,
    executionLatencyMs,
    status: exec.status,
    exportedAt: new Date().toISOString(),
  };
  const sha256Anchor = hashProofBody(unsigned);
  return {
    sha256Anchor,
    venueLabel: resolveVenueLabel(exec.venue),
    fillPriceUsd: exec.amountUsd,
    slippageSavedUsd,
    slippageSavedBps,
    executionLatencyMs,
    proofJson: { ...unsigned, sha256Anchor },
  };
}

export async function copyExecutionProofJson(proofJson: Record<string, unknown>): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(JSON.stringify(proofJson, null, 2));
  return true;
}
