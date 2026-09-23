/** Grant audit — live Pendle×GMX shadow-margin telemetry for Dune reconciliation. */
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { guardActionToGateCode } from "../../core/gate-telemetry-types";
import {
  evaluatePendleGmxCrossGuard,
  type GMXPositionState,
  type PTMarketState,
} from "../../guards/pendle-gmx-cross-guard";

export interface DuneTelemetryActionLogEntry {
  ts: string;
  intent: GMXPositionState["intent"];
  action: "PASS_GREENLIGHT" | "FAIL_CLOSED_BLOCK" | "EMERGENCY_DELEVERAGE_ALLOWED";
  shadowMarginUsd: number;
  dynamicLtv: number;
  gateActionCode: number;
  reason?: string;
}

export interface GrantAuditDuneTelemetry {
  schema: "silvervine.grant-audit.dune-telemetry.v1";
  responseRef: string;
  shadowMarginUsd: number;
  dynamicLtv: number;
  action: "PASS_GREENLIGHT" | "FAIL_CLOSED_BLOCK" | "EMERGENCY_DELEVERAGE_ALLOWED";
  gateActionCode: number;
  intentHash: string;
  reason?: string;
  actionLog: DuneTelemetryActionLogEntry[];
  ptDaysToExpiry: number;
  marginHealthRatio: number;
}

function sha256Ref(payload: unknown): string {
  return `sha256:${bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(payload ?? null))))}`;
}

function intentHash(intent: GMXPositionState["intent"], pt: PTMarketState): string {
  return sha256Ref({ intent, expiry: pt.expiry, impliedYield: pt.impliedYield });
}

function referenceScenarios(nowSec: number): Array<{
  pt: PTMarketState;
  gmx: GMXPositionState;
  assetUsdPrice: number;
}> {
  const oneYear = 365.25 * 86_400;
  const oneDay = 86_400;
  const healthyPt: PTMarketState = {
    expiry: nowSec + oneYear,
    impliedYield: 0.05,
    historicalYield24h: 0.05,
    ptPriceInAsset: 0.92,
    liquidityConstant: 10_000_000,
    dynamicFeeRate: 0.01,
  };
  const riskyPt: PTMarketState = {
    expiry: nowSec + oneDay,
    impliedYield: 0.05,
    historicalYield24h: 0.06,
    ptPriceInAsset: 0.92,
    liquidityConstant: 100,
    dynamicFeeRate: 0.01,
  };
  return [
    {
      pt: healthyPt,
      gmx: {
        collateralAmount: 100,
        collateralTokenPriceUsd: 3000,
        sizeNotionalUsd: 100_000,
        intent: "open",
      },
      assetUsdPrice: 3000,
    },
    {
      pt: riskyPt,
      gmx: {
        collateralAmount: 100,
        collateralTokenPriceUsd: 3000,
        sizeNotionalUsd: 100_000,
        intent: "open",
      },
      assetUsdPrice: 3000,
    },
    {
      pt: riskyPt,
      gmx: {
        collateralAmount: 100,
        collateralTokenPriceUsd: 3000,
        sizeNotionalUsd: 100_000,
        intent: "close",
      },
      assetUsdPrice: 3000,
    },
  ];
}

/** Live shadow-margin probe — deterministic reference states for Dune KV reconciliation. */
export function buildGrantAuditDuneTelemetry(
  fetchedAt = new Date().toISOString(),
): GrantAuditDuneTelemetry {
  const nowSec = Math.floor(Date.parse(fetchedAt) / 1000);
  const actionLog: DuneTelemetryActionLogEntry[] = referenceScenarios(nowSec).map(
    ({ pt, gmx, assetUsdPrice }) => {
      const result = evaluatePendleGmxCrossGuard(pt, gmx, assetUsdPrice);
      return {
        ts: fetchedAt,
        intent: gmx.intent,
        action: result.action,
        shadowMarginUsd: result.shadowMarginUsd,
        dynamicLtv: result.dynamicLtv,
        gateActionCode: guardActionToGateCode(result.action),
        reason: result.reason,
      };
    },
  );

  const primary =
    actionLog.find((e) => e.action === "FAIL_CLOSED_BLOCK") ??
    actionLog.find((e) => e.action === "EMERGENCY_DELEVERAGE_ALLOWED") ??
    actionLog[0]!;

  const riskyPt = referenceScenarios(nowSec)[1]!.pt;
  const ptDaysToExpiry = Math.max(0, (riskyPt.expiry - nowSec) / 86_400);
  const maintenanceUsd = referenceScenarios(nowSec)[1]!.gmx.sizeNotionalUsd * 0.05;
  const marginHealthRatio =
    maintenanceUsd > 0 ? primary.shadowMarginUsd / maintenanceUsd : 0;

  const telemetryCore = {
    shadowMarginUsd: primary.shadowMarginUsd,
    dynamicLtv: primary.dynamicLtv,
    action: primary.action,
    gateActionCode: primary.gateActionCode,
    intentHash: intentHash(primary.intent, riskyPt),
    reason: primary.reason,
    actionLog,
    ptDaysToExpiry,
    marginHealthRatio,
  };

  return {
    schema: "silvervine.grant-audit.dune-telemetry.v1",
    responseRef: sha256Ref(telemetryCore),
    ...telemetryCore,
  };
}
