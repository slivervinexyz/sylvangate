/**
 * Risk control helpers — entry loss estimation (SSOT adjunct).
 * @see risk-control.ts — vineWrapProtection / rootProtection
 */

/** Estimate entry round-trip drag used as a conservative loss floor for vine wrap protection. */
export function estimateEntryLossUsd(
  capitalUsd: number,
  frictionRate: number,
  fixedCostUsd: number,
): number {
  return capitalUsd * frictionRate + fixedCostUsd;
}
