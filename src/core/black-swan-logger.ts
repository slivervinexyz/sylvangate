/**
 * Structured black-swan defense audit logs — JSON for CF log drains + HUD stream.
 */

export const BLACK_SWAN_HUD_TAG =
  "[CRITICAL: BLACK_SWAN_DEFENSE_ACTIVE]" as const;

export type BlackSwanLogEvent =
  | "BLACK_SWAN_LIQUIDITY_HALT"
  | "BLACK_SWAN_DEVIATION_LOCK"
  | "BLACK_SWAN_EMERGENCY_FLATTEN"
  | "BLACK_SWAN_DEFENSE_CLEARED";

export type BlackSwanLogLevel = "warn" | "error";

/** LuBan exoskeleton band — collapse boundary telemetry on black-swan events */
export type LubanBand = "SAFE" | "CAUTION" | "CRITICAL" | "COLLAPSE";

export interface BlackSwanLogPayload {
  level: BlackSwanLogLevel;
  module: "black-swan-defense";
  event: BlackSwanLogEvent;
  hudTag: typeof BLACK_SWAN_HUD_TAG | null;
  /** LuBan Metric posture at log time */
  lubanBand: LubanBand;
  timestamp: string;
  symbol: string;
  message: string;
  details: Record<string, number | string | boolean | null>;
}

const MAX_ROLLING_LOGS = 32;

let defenseActive = false;
let activeTriggers: string[] = [];
const rollingLogs: BlackSwanLogPayload[] = [];

function isoNow(at?: number): string {
  return new Date(at ?? Date.now()).toISOString();
}

/** True when a black-swan fuse is latched — blocks new ingress until cleared. */
export function isBlackSwanDefenseActive(): boolean {
  return defenseActive;
}

/** Active trigger codes for HUD / API telemetry. */
export function readBlackSwanActiveTriggers(): readonly string[] {
  return activeTriggers;
}

/** HUD label when defense is active; null when clear. */
export function getBlackSwanDefenseHudLabel(): string | null {
  return defenseActive ? BLACK_SWAN_HUD_TAG : null;
}

/** Rolling in-memory audit trail (tests + log stream). */
export function getRecentBlackSwanLogs(): readonly BlackSwanLogPayload[] {
  return rollingLogs;
}

export function setBlackSwanDefenseActive(
  active: boolean,
  triggers: readonly string[] = [],
): void {
  defenseActive = active;
  activeTriggers = active ? [...triggers] : [];
}

export function emitBlackSwanLog(
  input: Omit<BlackSwanLogPayload, "module" | "timestamp" | "lubanBand"> & {
    at?: number;
    lubanBand?: LubanBand;
  },
): BlackSwanLogPayload {
  const payload: BlackSwanLogPayload = {
    level: input.level,
    module: "black-swan-defense",
    event: input.event,
    hudTag: input.hudTag ?? (defenseActive ? BLACK_SWAN_HUD_TAG : null),
    lubanBand: input.lubanBand ?? (defenseActive ? "COLLAPSE" : "SAFE"),
    timestamp: isoNow(input.at),
    symbol: input.symbol,
    message: input.message,
    details: input.details,
  };

  rollingLogs.push(payload);
  if (rollingLogs.length > MAX_ROLLING_LOGS) {
    rollingLogs.shift();
  }

  const line = JSON.stringify(payload);
  if (payload.level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }

  return payload;
}

export function logBlackSwanTrip(input: {
  symbol: string;
  triggers: readonly string[];
  details: BlackSwanLogPayload["details"];
  at?: number;
}): BlackSwanLogPayload {
  setBlackSwanDefenseActive(true, input.triggers);
  return emitBlackSwanLog({
    level: "error",
    event: input.triggers.includes("BLACK_SWAN_DEVIATION_LOCK")
      ? "BLACK_SWAN_DEVIATION_LOCK"
      : "BLACK_SWAN_LIQUIDITY_HALT",
    hudTag: BLACK_SWAN_HUD_TAG,
    lubanBand: "COLLAPSE",
    symbol: input.symbol,
    message: `${BLACK_SWAN_HUD_TAG} ${input.triggers.join("|")}`,
    details: input.details,
    at: input.at,
  });
}

export function logBlackSwanEmergencyFlatten(input: {
  symbol: string;
  intentId: string;
  flattenedCount: number;
  triggers: readonly string[];
  at?: number;
}): BlackSwanLogPayload {
  return emitBlackSwanLog({
    level: "error",
    event: "BLACK_SWAN_EMERGENCY_FLATTEN",
    hudTag: BLACK_SWAN_HUD_TAG,
    lubanBand: "COLLAPSE",
    symbol: input.symbol,
    message: `${BLACK_SWAN_HUD_TAG} emergency auto-flatten via Saga ledger`,
    details: {
      intentId: input.intentId,
      flattenedCount: input.flattenedCount,
      triggers: input.triggers.join("|"),
    },
    at: input.at,
  });
}

/** @internal test reset */
export function __resetBlackSwanLoggerForTests(): void {
  defenseActive = false;
  activeTriggers = [];
  rollingLogs.length = 0;
}
