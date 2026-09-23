/** Soil env overrides + oracle-lag bypass filters. */
export const MIN_DEPTH_USD = 100_000;
export const HL_TESTNET_MIN_DEPTH_USD = 5_000;

export function resolveEnvMinDepthUsdOverride(): number | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const raw = process.env.MIN_DEPTH_USD ?? process.env.SOIL_MIN_DEPTH_USD;
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function resolveSoilMinDepthUsd(input: {
  minDepthUsd?: number;
  isTestnet?: boolean;
}): number {
  if (input.minDepthUsd !== undefined) return input.minDepthUsd;
  const envMin = resolveEnvMinDepthUsdOverride();
  if (envMin !== undefined) return envMin;
  if (input.isTestnet) return HL_TESTNET_MIN_DEPTH_USD;
  return MIN_DEPTH_USD;
}

export function shouldBypassOracleLagDeadlock(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const allow = process.env.ALLOW_STALE_ORACLE;
  return allow === "true" || allow === "1";
}

/** `BYPASS_SOIL_PROBE` is forbidden — live/harness must fail-closed on soil trip. */
export function assertSoilProbeBypassForbidden(): void {
  if (typeof process === "undefined" || !process.env) return;
  if (process.env.BYPASS_SOIL_PROBE === "true") {
    throw new Error("SOIL_BYPASS_FORBIDDEN: BYPASS_SOIL_PROBE is disabled — soil probe is mandatory");
  }
}

export function shouldBypassSoftConfirmationProbe(): boolean {
  return shouldBypassOracleLagDeadlock();
}

export function filterSoftConfirmationProbeReasons(reasons: readonly string[]): string[] {
  if (!shouldBypassSoftConfirmationProbe()) return [...reasons];
  return reasons.filter(
    (r) =>
      !r.includes("SOFT_CONFIRMATION_PROBE_MISSING") &&
      !r.includes("SOFT_CONFIRMATION_PROBE_STALE") &&
      !r.includes("SOFT_CONFIRMATION_DRIFT") &&
      !r.includes("SOFT_CONFIRMATION_RPC_FAIL") &&
      !r.includes("SOFT_CONFIRMATION"),
  );
}

export function filterOracleLagDeadlockReasons(reasons: readonly string[]): string[] {
  if (!shouldBypassOracleLagDeadlock()) return [...reasons];
  return reasons.filter((r) => !r.includes("ORACLE_LAG_DEADLOCK") && !r.includes("ORACLE_LAG:"));
}

export function suppressOracleLagDeadlockReason(reason: string | null): string | null {
  if (!reason || !shouldBypassOracleLagDeadlock()) return reason;
  const remaining = reason.split("|").filter((part) => !part.includes("ORACLE_LAG"));
  return remaining.length > 0 ? remaining.join("|") : null;
}
