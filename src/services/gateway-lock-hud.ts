/**
 * FW-10 gateway lock HUD — disambiguate R17 day rollover vs channel sever (cold path).
 */
import type { SessionKeyStatusTag } from "../core/system-state-types";
import type { CircuitBreakerSeverTarget } from "./root-protection-lib/circuit-breaker-sever";
import {
  checkRoot17DailyLimit,
  createRoot17DailyState,
} from "./root17-daily";

export type GatewayLockHudKind =
  | "SIGNING_OPEN"
  | "R17_DAILY_LIMIT"
  | "R17_DAY_ROLLOVER_CHANNEL_SEVERED"
  | "R20_PHYSICAL_DEADLOCK"
  | "HARDLOCK_GENERIC";

const GATEWAY_LABELS: Record<GatewayLockHudKind, string> = {
  SIGNING_OPEN: "GATEWAY : [ 🟢 SIGNING OPEN ]",
  R17_DAILY_LIMIT: "GATEWAY : [ 🔴 R17 DAILY LIMIT — CHANNEL SEVERED ]",
  R17_DAY_ROLLOVER_CHANNEL_SEVERED:
    "GATEWAY : [ 🟡 R17 DAY RESET — CHANNEL STILL SEVERED · REAUTH REQUIRED ]",
  R20_PHYSICAL_DEADLOCK: "GATEWAY : [ 🔴 R20 HARDLOCK ]",
  HARDLOCK_GENERIC: "GATEWAY : [ 🔴 CHANNEL SEVERED · REAUTH REQUIRED ]",
};

export function resolveGatewayLockHud(input: {
  signingChannelOpen: boolean;
  hardlock: boolean;
  sessionKeyStatus: SessionKeyStatusTag;
  severTarget: CircuitBreakerSeverTarget | null;
  root17Tripped: boolean;
}): { kind: GatewayLockHudKind; label: string } {
  if (!input.hardlock && input.signingChannelOpen) {
    return { kind: "SIGNING_OPEN", label: GATEWAY_LABELS.SIGNING_OPEN };
  }
  if (
    input.severTarget === "R20" ||
    input.sessionKeyStatus === "R20_DEADLOCK"
  ) {
    return {
      kind: "R20_PHYSICAL_DEADLOCK",
      label: GATEWAY_LABELS.R20_PHYSICAL_DEADLOCK,
    };
  }
  if (input.severTarget === "R17") {
    if (input.root17Tripped) {
      return { kind: "R17_DAILY_LIMIT", label: GATEWAY_LABELS.R17_DAILY_LIMIT };
    }
    return {
      kind: "R17_DAY_ROLLOVER_CHANNEL_SEVERED",
      label: GATEWAY_LABELS.R17_DAY_ROLLOVER_CHANNEL_SEVERED,
    };
  }
  return { kind: "HARDLOCK_GENERIC", label: GATEWAY_LABELS.HARDLOCK_GENERIC };
}

/** Telemetry/HUD builder — derives root17 trip from UTC-day counters. */
export function resolveGatewayLockHudFromTelemetry(
  state: {
    signingChannelOpen: boolean;
    hardlock: boolean;
    sessionKeyStatus: SessionKeyStatusTag;
    accountBalanceUsd: number;
  },
  severTarget: CircuitBreakerSeverTarget | null,
  now: Date = new Date(),
): { kind: GatewayLockHudKind; label: string } {
  const root17 = checkRoot17DailyLimit({
    accountEquityUsd: state.accountBalanceUsd,
    state: createRoot17DailyState(now),
    now,
  });
  return resolveGatewayLockHud({
    signingChannelOpen: state.signingChannelOpen,
    hardlock: state.hardlock,
    sessionKeyStatus: state.sessionKeyStatus,
    severTarget,
    root17Tripped: root17.tripped,
  });
}
