/** High-visibility banner when GMX live-fill stale-oracle env is armed (execution proof ≠ firewall demo). */
import { assertAirlockProbeBypassForbidden } from "../../src/core/airlock-threshold-core";

export function isLiveHarnessBypassArmed(): boolean {
  assertAirlockProbeBypassForbidden();
  return process.env.ALLOW_STALE_ORACLE === "1" || process.env.ALLOW_STALE_ORACLE === "true";
}

export function printLiveHarnessBypassBanner(): void {
  assertAirlockProbeBypassForbidden();
  if (!isLiveHarnessBypassArmed()) return;

  console.warn(`
  ====================================================================
  [DEMO MONITOR PREVIEW - EXECUTION IS NOT FIREWALL]
  WARNING: STALE-ORACLE OVERRIDE ARMED (ALLOW_STALE_ORACLE).
  SOIL PROBE REMAINS MANDATORY — BYPASS_AIRLOCK_PROBE IS FORBIDDEN.
  DO NOT USE THIS EXECUTION STATE FOR LIVE-FIRE QUANT TRADING.
  ====================================================================
  `);
}
