/** Risk co-pilot — cold English guardrail copy (grant-facing). */

export const COPILOT_PREFIX = "[Risk Co-Pilot]:" as const;
export const YIN_GUARD_MODE_BADGE = "[ GUARD MODE ]" as const;
export const AUTO_PILOT_BASIS_BADGE =
  "[ Auto-Pilot Basis Arbitrage : Zero-Friction Setup ]" as const;
export const MILESTONE_SANDBOX_BADGE =
  "[ Remark: Milestone 2 Deliverable — Live Sandbox Execution Active ]" as const;

export const R20_DEADLOCK_OVERLAY_TITLE =
  "[R20 PHYSICAL DEADLOCK ENGAGED]" as const;
export const R20_DEADLOCK_OVERLAY_BODY =
  "Hot Key signing channel severed. Session keys revoked. All open orders auto-suppressed." as const;

export interface CopilotSoilCareInput {
  orderSizeUsd: number;
  soilCapacityPct?: number;
  cappedMaxSlUsd: number;
}

export interface BasisHedgePrefillRow {
  k1_basis_sp?: number;
  n1_friction?: number;
  o1_cost_usd?: number;
  c1_hl_spot?: number;
  d1_hl_perp?: number;
  actionStatus?: string;
}

export interface BasisHedgePrefill {
  basisRatio: number;
  frictionPct: number;
  fixedCostUsd: number;
  suggestedCapitalUsd: number;
  suggestedOrderSizeUsd: number;
}

function fmtUsd(n: number): string {
  return Math.max(0, n).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

/** Co-Pilot care line when soil / dynamic Max SL auto-caps risk. */
export function formatCopilotSoilCareMessage(input: CopilotSoilCareInput): string {
  const pct = ((input.soilCapacityPct ?? 0.005) * 100).toFixed(2);
  return (
    `${COPILOT_PREFIX} Order size $${fmtUsd(input.orderSizeUsd)} exceeds soil capacity (${pct}%). ` +
    `Dynamic Max SL auto-capped max risk to $${fmtUsd(input.cappedMaxSlUsd)}. Equity protected.`
  );
}

/** Derive Step 3 prefill from Best Hedge matrix row (basis-neutral). */
export function computeBasisHedgePrefill(
  row: BasisHedgePrefillRow,
  vaultEquityUsd: number,
): BasisHedgePrefill {
  const spot = Number(row.c1_hl_spot) || Number(row.d1_hl_perp) || 0;
  const perp = Number(row.d1_hl_perp) || spot;
  const basisRatio =
    Number.isFinite(Number(row.k1_basis_sp)) && row.k1_basis_sp !== undefined
      ? Number(row.k1_basis_sp)
      : spot > 0
        ? (perp - spot) / spot
        : 0;
  const frictionPct = Math.max(0, Number(row.n1_friction) || 0.24);
  const fixedCostUsd = Math.max(0, Number(row.o1_cost_usd) || 2.5);
  const equity = Math.max(0, vaultEquityUsd);
  const suggestedCapitalUsd = equity > 0 ? Math.min(equity, 25_000) : 10_000;
  const suggestedOrderSizeUsd = Math.min(
    suggestedCapitalUsd,
    Math.max(1_000, Math.round(suggestedCapitalUsd * 0.4)),
  );
  return {
    basisRatio,
    frictionPct,
    fixedCostUsd,
    suggestedCapitalUsd,
    suggestedOrderSizeUsd,
  };
}
