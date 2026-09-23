/**
 * Escalation state projection for /api/logs JSON output.
 */

import {
  evaluateEscalationLadder,
  type EscalationRiskState,
} from "./escalation-ladder";
import { soilCompensation } from "./soil-compensation";

export interface EscalationStatePayload {
  state: EscalationRiskState;
  maxLeverage: number;
  liquidationDistancePct: number | null;
  preemptiveReductionTriggered: boolean;
  soilCompensationExecuted: boolean;
  spotToPerpTransferUsd: number;
  targetLeverage: number;
  reasons: string[];
  updatedAt: string;
}

function idleEscalationPayload(): EscalationStatePayload {
  return {
    state: "GREEN",
    maxLeverage: 10,
    liquidationDistancePct: null,
    preemptiveReductionTriggered: false,
    soilCompensationExecuted: false,
    spotToPerpTransferUsd: 0,
    targetLeverage: 10,
    reasons: ["ESCALATION_IDLE:GREEN"],
    updatedAt: new Date().toISOString(),
  };
}

/** Build escalationState block for grant/logs API from latest KV snapshot. */
export function buildEscalationStateForLogs(latest: unknown): EscalationStatePayload {
  if (!latest || typeof latest !== "object") {
    return idleEscalationPayload();
  }

  const row = latest as Record<string, unknown>;
  const stored = row.escalationState;
  if (stored && typeof stored === "object") {
    return stored as EscalationStatePayload;
  }

  const dist =
    typeof row.liquidationDistancePct === "number"
      ? row.liquidationDistancePct
      : typeof row.liqDistancePct === "number"
        ? row.liqDistancePct
        : null;

  if (dist == null || !Number.isFinite(dist)) {
    return idleEscalationPayload();
  }

  const positionHealth =
    row.positionHealth && typeof row.positionHealth === "object"
      ? (row.positionHealth as {
          unifiedAvailableUsd?: number;
          spotUsdcUsd?: number;
          perpsEquityUsd?: number;
        })
      : null;

  const equity =
    positionHealth?.unifiedAvailableUsd ??
    (typeof row.unifiedAvailableUsd === "number"
      ? row.unifiedAvailableUsd
      : 0);
  const shortNotional =
    typeof row.shortNotionalUsd === "number" ? row.shortNotionalUsd : 0;
  const spotUsdc =
    positionHealth?.spotUsdcUsd ??
    (typeof row.spotUsdcUsd === "number" ? row.spotUsdcUsd : 0);
  const perpMargin =
    positionHealth?.perpsEquityUsd ??
    (typeof row.perpMarginUsd === "number" ? row.perpMarginUsd : 0);

  const prevState =
    typeof row.previousEscalationState === "string"
      ? (row.previousEscalationState as EscalationRiskState)
      : undefined;

  const ladder = evaluateEscalationLadder({
    liquidationDistancePct: dist,
    accountEquityUsd: equity,
    shortNotionalUsd: shortNotional,
    previousState: prevState,
  });

  const compensation =
    ladder.state === "ORANGE"
      ? soilCompensation({
          spotUsdcUsd: spotUsdc,
          perpMarginUsd: perpMargin,
          liquidationDistancePct: dist,
          shortNotionalUsd: shortNotional,
        })
      : null;

  return {
    state: ladder.state,
    maxLeverage: ladder.maxLeverage,
    liquidationDistancePct: dist,
    preemptiveReductionTriggered: ladder.leverage.preemptiveReductionTriggered,
    soilCompensationExecuted: compensation?.executed ?? false,
    spotToPerpTransferUsd: compensation?.spotToPerpTransferUsd ?? 0,
    targetLeverage: ladder.leverage.targetLeverage,
    reasons: [
      ...ladder.reasons,
      ...(compensation?.executed ? [compensation.reason] : []),
    ],
    updatedAt:
      typeof row.timestamp === "string"
        ? row.timestamp
        : new Date().toISOString(),
  };
}
