/**
 * HUD stream payload builders — live payload assembly.
 */

import {
  getBlackSwanDefenseHudLabel,
  isBlackSwanDefenseActive,
  readBlackSwanActiveTriggers,
} from "../../core/black-swan-guard";
import { isR20Locked, readActiveSystemState, type CoreSystemState } from "../../core/state";
import {
  auditThreeEyeAdapters,
  TELEMETRY_VENUES,
} from "../../services/hl-telemetry-probe";
import { fetchLiveL2Book } from "../../services/exchanges/hl-l2-book";
import { resolveGatewayLockHudFromTelemetry } from "../../services/gateway-lock-hud";
import { readActiveCircuitBreakerSeverTarget } from "../../services/rootProtectionService";
import {
  HUD_FALLBACK_LIVE_PAIRS,
  HUD_FALLBACK_MARKET_PROBE,
  HUD_STREAM_DEBOUNCE_MS,
  type HudConnectivityMode,
  type HudStreamPayload,
} from "./hud-telemetry-log-types";
import { attachCircuitBreakerTerminalLogs } from "./hud-telemetry-terminal";

function buildHudStreamFallbackPayload(now = Date.now()): HudStreamPayload {
  const state = readActiveSystemState();
  const gateway = resolveGatewayLockHudFromTelemetry(
    state,
    readActiveCircuitBreakerSeverTarget(),
    new Date(now),
  );
  return {
    success: true,
    timestamp: new Date(now).toISOString(),
    debounceMs: HUD_STREAM_DEBOUNCE_MS,
    isStale: true,
    connectivityMode: "STANDBY",
    marketProbe: HUD_FALLBACK_MARKET_PROBE,
    leftEyeDefense: {
      status: "STANDBY",
      dynamicMaxSlUsd: state.dynamicMaxSL,
      hardlock: state.hardlock,
      gatewayLockKind: gateway.kind,
      gatewayLabel: gateway.label,
    },
    rightEyeProbe: {
      status: "STANDBY",
      santenmokuStatus: "THREE_EYES_DEGRADED",
      activeVenues: TELEMETRY_VENUES,
    },
    crownTreasuryPnl: {
      accountBalanceUsd: state.accountBalanceUsd,
      estimatedPnlUsd: state.accountBalanceUsd - 10_000,
      criIndex: state.currentCri,
      hudState: "IDLE",
    },
    blackSwanDefense: {
      active: isBlackSwanDefenseActive(),
      hudTag: getBlackSwanDefenseHudLabel(),
      triggers: readBlackSwanActiveTriggers(),
    },
  };
}

function isHudDryRunView(state: CoreSystemState): boolean {
  return (
    !state.signingChannelOpen ||
    state.isSandboxMode ||
    state.hardlock ||
    isR20Locked(state)
  );
}

function resolveConnectivityMode(
  state: CoreSystemState,
  dryRun: boolean,
  rightStatus: HudStreamPayload["rightEyeProbe"]["status"],
): HudConnectivityMode {
  if (dryRun) return "CONNECTED_MOCK";
  if (state.hardlock || isR20Locked(state)) return "DISCONNECTED";
  if (rightStatus === "STANDBY" || state.isStale) return "STANDBY";
  return "CONNECTED";
}

export function buildHudStreamPayload(now = Date.now()): HudStreamPayload {
  const state = readActiveSystemState();
  const threeEye = auditThreeEyeAdapters(state);
  const dryRun = isHudDryRunView(state);

  const leftStatus = dryRun
    ? "STANDBY"
    : state.hardlock
      ? "LOCKED"
      : state.isHedgeActive
        ? "PASS"
        : "STANDBY";

  const rightStatus = dryRun
    ? "STANDBY"
    : threeEye.santenmokuStatus === "THREE_EYES_ACTIVE"
      ? "ACTIVE"
      : threeEye.santenmokuStatus === "THREE_EYES_DEGRADED"
        ? "STANDBY"
        : "OFFLINE";

  const useFallbackMarket =
    dryRun || threeEye.activeVenues.length === 0 || rightStatus !== "ACTIVE";

  const estimatedPnlUsd = state.accountBalanceUsd - 10_000;
  const connectivityMode = resolveConnectivityMode(state, dryRun, rightStatus);
  const gateway = resolveGatewayLockHudFromTelemetry(
    state,
    readActiveCircuitBreakerSeverTarget(),
    new Date(now),
  );

  const basePayload: Omit<HudStreamPayload, "circuitBreakerTerminalLogs"> = {
    success: true,
    timestamp: new Date(now).toISOString(),
    debounceMs: HUD_STREAM_DEBOUNCE_MS,
    isStale: dryRun ? false : state.isStale,
    connectivityMode,
    marketProbe: useFallbackMarket
      ? HUD_FALLBACK_MARKET_PROBE
      : {
          selectToken: HUD_FALLBACK_MARKET_PROBE.selectToken,
          bestToken: HUD_FALLBACK_MARKET_PROBE.bestToken,
          livePairsCount: HUD_FALLBACK_LIVE_PAIRS,
          topPairs: HUD_FALLBACK_MARKET_PROBE.topPairs,
        },
    leftEyeDefense: {
      status: leftStatus,
      dynamicMaxSlUsd: state.dynamicMaxSL,
      hardlock: dryRun ? false : state.hardlock,
      gatewayLockKind: gateway.kind,
      gatewayLabel: gateway.label,
    },
    rightEyeProbe: {
      status: rightStatus,
      santenmokuStatus: dryRun
        ? "THREE_EYES_STANDBY"
        : threeEye.santenmokuStatus,
      activeVenues: dryRun
        ? TELEMETRY_VENUES
        : threeEye.activeVenues.length > 0
          ? threeEye.activeVenues
          : TELEMETRY_VENUES,
    },
    crownTreasuryPnl: {
      accountBalanceUsd: state.accountBalanceUsd,
      estimatedPnlUsd,
      criIndex: state.currentCri,
      hudState: dryRun ? "IDLE" : state.hudState,
    },
    blackSwanDefense: {
      active: isBlackSwanDefenseActive(),
      hudTag: getBlackSwanDefenseHudLabel(),
      triggers: readBlackSwanActiveTriggers(),
    },
  };

  return attachCircuitBreakerTerminalLogs(basePayload);
}

/** Never throws — degraded payload on probe/build failure. */
export function buildHudStreamPayloadSafe(now = Date.now()): HudStreamPayload {
  try {
    return buildHudStreamPayload(now);
  } catch (err) {
    console.error("[hud-stream] payload build failed — serving fallback", err);
    return buildHudStreamFallbackPayload(now);
  }
}

/** Non-blocking L2 depth probe for HUD pollers — never throws. */
export async function probeHudBookDepthSafe(coin = "ETH"): Promise<void> {
  try {
    await fetchLiveL2Book(coin, { maxRetries: 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[hud-stream] Fallback depth used:", message);
  }
}
