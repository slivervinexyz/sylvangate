/** KPI tooltip copy for Internal Index HUD (F-pattern hub). */

export const KPI_TOOLTIPS = {
  shieldMorph:
    "Active shield morph. Ruin Lock = hard-lock signing, halt new orders, protect principal.",
  tension:
    "Santenmoku Tension 0–100: higher = calmer. ~50.00 = Santenmoku Vector Equilibrium zero-friction.",
  slippage: "Slippage (bps): fill vs expected. Lower is better.",
  latency: "Execution latency (ms). Lower reduces sandwich window.",
  net: "Net yield (bps) after slippage/friction. Positive = gain.",
  risk: "Risk status label after soil/slip/gate aggregation.",
} as const;
