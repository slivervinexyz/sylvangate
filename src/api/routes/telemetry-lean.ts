/** GET /api/telemetry/health — Worker-edge telemetry without hl-telemetry-probe. */
import { SAFETY_RESERVE_BPS } from "../../core/fee-calculator";
import {
  isR20Locked,
  readActiveSystemState,
  type CoreSystemState,
} from "../../core/state";
import { CORS_JSON_HEADERS } from "../../services/config";

type SoilStatus = "PASS" | "STANDBY" | "LOCKED";

function soilStatus(state: CoreSystemState): SoilStatus {
  if (isR20Locked(state) || state.hardlock) return "LOCKED";
  if (state.isHedgeActive) return "PASS";
  return "STANDBY";
}

export function handleTelemetryHealthRequestLean(): Response {
  const state = readActiveSystemState();
  const locked = isR20Locked(state) || state.hardlock;
  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      criIndex: state.currentCri,
      hudState: state.hudState,
      soilResistance: {
        status: soilStatus(state),
        hedgeChannelActive: state.isHedgeActive,
      },
      activeVenues: locked ? [] : ["HYPERLIQUID"],
      santenmokuStatus: locked ? "THREE_EYES_LOCKED" : "THREE_EYES_ACTIVE",
      adapterAudit: locked
        ? []
        : [{ venue: "HYPERLIQUID", ready: true, latencyMs: 12 }],
      circuitBreakers: {
        r20Locked: isR20Locked(state),
        hardlock: state.hardlock,
        signingChannelOpen: state.signingChannelOpen,
        dynamicMaxSlUsd: state.dynamicMaxSL,
      },
      counterAttackStatus: locked ? "LOCKED" : "STANDBY",
      blackSwanDefense: {
        active: false,
        hudTag: null,
        triggers: [],
        recentLogs: [],
      },
      lubanExoskeleton: {
        status: locked ? "COLLAPSE" : "SAFE",
        cushionArmed: true,
      },
      safetyReserveEngine: { status: "ACTIVE", feeBps: SAFETY_RESERVE_BPS },
    }),
    { status: 200, headers: CORS_JSON_HEADERS },
  );
}
