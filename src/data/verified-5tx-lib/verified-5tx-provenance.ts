/**
 * M5 — Hyperliquid testnet 5-trade sequence provenance for `/api/grant-audit`.
 */

import {
  VERIFIED_5TX_NOTIONAL_USD,
  VERIFIED_5TX_ORDER_COUNT,
} from "./verified-5tx-constants";
import { loadVerified5TxResults } from "./verified-5tx-fill-helpers";
import type { Verified5TxFillRecord, Verified5TxResults } from "./verified-5tx-types";
import type { ProvenanceVerifiedTrades } from "../../routes/grant-audit-lib/grant-audit-provenance";
import { attachProvenanceVerifiedTrades } from "../../routes/grant-audit-lib/grant-audit-provenance";
import type { GrantAuditPayload } from "../../routes/grant-audit-lib/grant-audit.types";

export const HL_5TX_MAX_GATED_SLIPPAGE_BPS = 50;
export const HL_5TX_FILL_TIME_MAX_GAP_SEC = 30;
/** Per-leg margin SSOT — matches verified_5tx_results.json ($12, above HL $10 floor). */
export const HL_5TX_MARGIN_ALLOCATION_USD = VERIFIED_5TX_NOTIONAL_USD;

export interface Hl5TradeSequenceAudit {
  ok: boolean;
  fillCount: number;
  oidContinuityOk: boolean;
  marginAllocationOk: boolean;
  slippageBoundsOk: boolean;
  soilPassedOk: boolean;
  reasons: string[];
}

export interface GrantAuditProvenanceBundle {
  provenanceVerified: ProvenanceVerifiedTrades | null;
  hl5TradeSequence: Hl5TradeSequenceAudit;
  testnetSuite: Verified5TxResults;
}

function validateOidContinuity(fills: readonly Verified5TxFillRecord[]): boolean {
  if (fills.length !== VERIFIED_5TX_ORDER_COUNT) return false;
  for (let i = 0; i < fills.length; i++) {
    if (fills[i]?.index !== i + 1) return false;
  }
  return true;
}

function validateFillTimeContinuity(fills: readonly Verified5TxFillRecord[]): boolean {
  for (let i = 1; i < fills.length; i++) {
    const prev = fills[i - 1]?.fillTimeSec ?? 0;
    const cur = fills[i]?.fillTimeSec ?? 0;
    if (cur < prev) return false;
    if (cur - prev > HL_5TX_FILL_TIME_MAX_GAP_SEC) return false;
  }
  return true;
}

function validateMarginAllocation(fills: readonly Verified5TxFillRecord[]): boolean {
  return fills.every(
    (f) =>
      f.notionalUsd >= HL_5TX_MARGIN_ALLOCATION_USD - 2 &&
      f.notionalUsd <= HL_5TX_MARGIN_ALLOCATION_USD + 2,
  );
}

function validateSlippageBounds(fills: readonly Verified5TxFillRecord[]): boolean {
  return fills.every(
    (f) =>
      f.gatedSlippageBps >= 0 &&
      f.gatedSlippageBps <= HL_5TX_MAX_GATED_SLIPPAGE_BPS &&
      f.rawSlippageBps >= f.gatedSlippageBps,
  );
}

/** Audit HL testnet 5-trade cross-venue hedge execution history. */
export function auditHl5TradeSequence(
  results: Verified5TxResults = loadVerified5TxResults(),
): Hl5TradeSequenceAudit {
  const reasons: string[] = [];
  const fills = results.fills ?? [];
  const fillCount = fills.length;

  if (fillCount !== VERIFIED_5TX_ORDER_COUNT) {
    reasons.push(`FILL_COUNT=${fillCount}!=${VERIFIED_5TX_ORDER_COUNT}`);
  }

  const oidContinuityOk =
    validateOidContinuity(fills) && validateFillTimeContinuity(fills);
  if (!oidContinuityOk) reasons.push("OID_OR_FILL_TIME_DISCONTINUITY");

  const marginAllocationOk = validateMarginAllocation(fills);
  if (!marginAllocationOk) reasons.push("MARGIN_ALLOCATION_OUT_OF_BAND");

  const slippageBoundsOk = validateSlippageBounds(fills);
  if (!slippageBoundsOk) reasons.push("SLIPPAGE_BOUNDS_EXCEEDED");

  const soilPassedOk = fills.every((f) => f.soilPassed);
  if (!soilPassedOk) reasons.push("SOIL_GATE_FAILED_ON_FILL");

  if (results.network !== "hyperliquid-testnet") {
    reasons.push(`NETWORK=${results.network}`);
  }

  return {
    ok: reasons.length === 0,
    fillCount,
    oidContinuityOk,
    marginAllocationOk,
    slippageBoundsOk,
    soilPassedOk,
    reasons,
  };
}

/** Machine-readable bundle for grant-audit `provenanceVerified` attachment. */
export function buildGrantAuditProvenanceBundle(
  auditPayload: GrantAuditPayload,
  results: Verified5TxResults = loadVerified5TxResults(),
): GrantAuditProvenanceBundle {
  const attached = attachProvenanceVerifiedTrades(auditPayload);
  return {
    provenanceVerified: attached.provenanceVerified,
    hl5TradeSequence: auditHl5TradeSequence(results),
    testnetSuite: results,
  };
}
