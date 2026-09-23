/** High-visibility banner when GMX live-fill stale-oracle env is armed (execution proof ≠ firewall demo). */
import { assertSoilProbeBypassForbidden } from "../../src/core/soil-resistance-core";

export function isLiveHarnessBypassArmed(): boolean {
  assertSoilProbeBypassForbidden();
  return process.env.ALLOW_STALE_ORACLE === "1" || process.env.ALLOW_STALE_ORACLE === "true";
}

export function printLiveHarnessBypassBanner(): void {
  assertSoilProbeBypassForbidden();
  if (!isLiveHarnessBypassArmed()) return;

  console.warn(`
  ====================================================================
  [DEMO MONITOR PREVIEW - EXECUTION IS NOT FIREWALL]
  WARNING: STALE-ORACLE OVERRIDE ARMED (ALLOW_STALE_ORACLE).
  SOIL PROBE REMAINS MANDATORY — BYPASS_SOIL_PROBE IS FORBIDDEN.
  DO NOT USE THIS EXECUTION STATE FOR LIVE-FIRE QUANT TRADING.
  ====================================================================
  `);
}
