/**
 * GMX Grant / B2B telemetry probe — Hyperliquid adapter friction SSOT.
 */
import { evaluateSoilResistance as evaluateHyperliquidMarginHealth } from "./exchanges/hl-margin";
import { isR20Locked, type CoreSystemState } from "../core/state";
import { checkSoilResistance, type SoilResistanceInput } from "../core/risk";

export const TELEMETRY_VENUES = ["HYPERLIQUID"] as const;
export type TelemetryVenue = (typeof TELEMETRY_VENUES)[number];

export type GatewayTelemetryStatus =
  | "GATEWAY_ACTIVE"
  | "GATEWAY_DEGRADED"
  | "GATEWAY_LOCKED";

/** @deprecated Grant HUD legacy alias */
export type SantenmokuThreeEyeStatus =
  | "THREE_EYES_ACTIVE"
  | "THREE_EYES_DEGRADED"
  | "THREE_EYES_LOCKED";

export type CounterAttackStatus = "ARMED_AND_READY" | "STANDBY" | "LOCKED" | "REJECT";

export interface VenueAdapterAudit {
  venue: TelemetryVenue;
  ready: boolean;
  soilOk: boolean;
}

export interface GrantTelemetryAuditResult {
  activeVenues: readonly TelemetryVenue[];
  gatewayStatus: GatewayTelemetryStatus;
  adapters: readonly VenueAdapterAudit[];
}

const HL_SOIL_PROBE: SoilResistanceInput = {
  symbol: "ETH",
  hlSpot: 3_500,
  hlPerp: 3_501,
  dydxPerp: 3_500.5,
  depthUsd: 500_000,
};

function mapGatewayStatus(status: GatewayTelemetryStatus): SantenmokuThreeEyeStatus {
  if (status === "GATEWAY_ACTIVE") return "THREE_EYES_ACTIVE";
  if (status === "GATEWAY_LOCKED") return "THREE_EYES_LOCKED";
  return "THREE_EYES_DEGRADED";
}

function probeHyperliquidAdapter(): VenueAdapterAudit {
  try {
    const soil = checkSoilResistance(HL_SOIL_PROBE);
    const marginTier = evaluateHyperliquidMarginHealth(25);
    const soilOk = soil.ok && marginTier === "HEALTHY";
    return {
      venue: "HYPERLIQUID",
      ready: soilOk,
      soilOk,
    };
  } catch (err) {
    console.error("[hl-telemetry] HYPERLIQUID probe failed", err);
    return { venue: "HYPERLIQUID", ready: false, soilOk: false };
  }
}

export function auditGrantTelemetryAdapters(state: CoreSystemState): GrantTelemetryAuditResult {
  if (isR20Locked(state) || state.hardlock || !state.signingChannelOpen) {
    return {
      activeVenues: [],
      gatewayStatus: "GATEWAY_LOCKED",
      adapters: TELEMETRY_VENUES.map((venue) => ({ venue, ready: false, soilOk: false })),
    };
  }

  const adapters = [probeHyperliquidAdapter()] as const;
  const allReady = adapters.every((adapter) => adapter.ready);
  return {
    activeVenues: allReady ? TELEMETRY_VENUES : [],
    gatewayStatus: allReady ? "GATEWAY_ACTIVE" : "GATEWAY_DEGRADED",
    adapters,
  };
}

/** @deprecated Use auditGrantTelemetryAdapters */
export function auditThreeEyeAdapters(state: CoreSystemState): {
  activeVenues: readonly TelemetryVenue[];
  santenmokuStatus: SantenmokuThreeEyeStatus;
  adapters: readonly VenueAdapterAudit[];
} {
  const audit = auditGrantTelemetryAdapters(state);
  return {
    activeVenues: audit.activeVenues,
    santenmokuStatus: mapGatewayStatus(audit.gatewayStatus),
    adapters: audit.adapters,
  };
}

export const DEFAULT_COUNTER_ATTACK_COIN = "ETH" as const;

export function readCounterAttackTelemetryStatus(state: CoreSystemState): CounterAttackStatus {
  const audit = auditGrantTelemetryAdapters(state);
  if (audit.gatewayStatus === "GATEWAY_LOCKED") return "LOCKED";
  return "STANDBY";
}
