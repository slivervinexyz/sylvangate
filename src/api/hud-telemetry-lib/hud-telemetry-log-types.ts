/**
 * HUD stream payload builders — types and constants.
 */

import type { CircuitBreakerTerminalEntry } from "../../services/rootProtectionService";
import type { GatewayLockHudKind } from "../../services/gateway-lock-hud";
import type { TerminalLogLevel } from "../../lib/gui-bridge/terminal-log";

export type { CircuitBreakerTerminalEntry };

/** Min interval between JSON payloads + SSE ping cadence (dev-safe). */
export const HUD_STREAM_DEBOUNCE_MS = 1_000;
export const HUD_STREAM_PING_MS = HUD_STREAM_DEBOUNCE_MS;

export const HUD_FALLBACK_LIVE_PAIRS = 162;

export type HudConnectivityMode =
  | "CONNECTED"
  | "CONNECTED_MOCK"
  | "STANDBY"
  | "DISCONNECTED";

export interface HudMarketPair {
  symbol: string;
  annualYieldPct: number;
}

export interface HudMarketProbe {
  selectToken: string;
  bestToken: string;
  topPairs: readonly HudMarketPair[];
  livePairsCount: number;
}

export const HUD_FALLBACK_MARKET_PROBE: HudMarketProbe = {
  selectToken: "ETH",
  bestToken: "ETH",
  livePairsCount: HUD_FALLBACK_LIVE_PAIRS,
  topPairs: [{ symbol: "ETH", annualYieldPct: 18.2 }],
};

export interface HudStreamPayload {
  success: true;
  timestamp: string;
  debounceMs: number;
  isStale: boolean;
  connectivityMode: HudConnectivityMode;
  marketProbe: HudMarketProbe;
  leftEyeDefense: {
    status: "PASS" | "STANDBY" | "LOCKED";
    dynamicMaxSlUsd: number;
    hardlock: boolean;
    gatewayLockKind: GatewayLockHudKind;
    gatewayLabel: string;
  };
  rightEyeProbe: {
    status: "ACTIVE" | "STANDBY" | "OFFLINE";
    santenmokuStatus: string;
    activeVenues: readonly string[];
  };
  crownTreasuryPnl: {
    accountBalanceUsd: number;
    estimatedPnlUsd: number;
    criIndex: number;
    hudState: string;
  };
  blackSwanDefense: {
    active: boolean;
    hudTag: string | null;
    triggers: readonly string[];
  };
  circuitBreakerTerminalLogs?: readonly CircuitBreakerTerminalEntry[];
}

export interface HudTerminalSeverLog {
  level: TerminalLogLevel;
  message: string;
}
