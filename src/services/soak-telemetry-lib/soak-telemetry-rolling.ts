/**
 * 24/7 sandbox soak telemetry — rolling log persistence.
 */

import type { Env } from "../../env";
import { saveSoakTelemetryToKV } from "../kv-store";
import {
  SOAK_ROLLING_MAX_TICKS,
  SOAK_TELEMETRY_KV_KEY,
  type SoakTelemetryRollingLog,
  type SoakTelemetryTick,
} from "./soak-telemetry-types";

let inMemoryRollingLog: SoakTelemetryRollingLog = {
  version: 1,
  lastUpdated: new Date(0).toISOString(),
  tickCount: 0,
  ticks: [],
};

export function createEmptySoakLog(): SoakTelemetryRollingLog {
  return {
    version: 1,
    lastUpdated: new Date(0).toISOString(),
    tickCount: 0,
    ticks: [],
  };
}

export function appendSoakTicks(
  log: SoakTelemetryRollingLog,
  ticks: SoakTelemetryTick[],
  maxTicks = SOAK_ROLLING_MAX_TICKS,
): SoakTelemetryRollingLog {
  const merged = [...log.ticks, ...ticks];
  const trimmed =
    merged.length > maxTicks ? merged.slice(merged.length - maxTicks) : merged;

  return {
    version: 1,
    lastUpdated: ticks.at(-1)?.at ?? new Date().toISOString(),
    tickCount: log.tickCount + ticks.length,
    ticks: trimmed,
  };
}

export async function loadRollingLog(
  kv?: Env["SLIVERVINE_KV"],
): Promise<SoakTelemetryRollingLog> {
  if (!kv) return inMemoryRollingLog;

  const raw = await kv.get(SOAK_TELEMETRY_KV_KEY);
  if (!raw) return createEmptySoakLog();

  try {
    return JSON.parse(raw) as SoakTelemetryRollingLog;
  } catch {
    return createEmptySoakLog();
  }
}

export async function persistRollingLog(
  log: SoakTelemetryRollingLog,
  kv?: Env["SLIVERVINE_KV"],
): Promise<void> {
  const result = await saveSoakTelemetryToKV(kv, log);
  if (!result.skipped) return;

  inMemoryRollingLog = log;
}

/** @internal Test hook */
export function __resetSoakTelemetryForTests(): void {
  inMemoryRollingLog = createEmptySoakLog();
}

/** Read in-memory rolling log (local soak harness). */
export function readInMemorySoakLog(): SoakTelemetryRollingLog {
  return inMemoryRollingLog;
}
