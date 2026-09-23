/**
 * Top-level page accordion state for the Worker dashboard.
 * Browser runtime still mutates DOM from the inline script; these helpers
 * keep step IDs, badge copy, and initial defaults consistent.
 */

export type ActivePageStep = 1 | 2 | 3 | 4;

export const PAGE_STEP_TITLES = {
  1: "Step 1 · Sanctuary Defense Grid",
  2: "Step 2 · Cross-Market Asset Matrix",
  3: "Step 3 🏛️ SANTENMOKU Vault",
  4: "Step 4 · Position & Arbitrage Log",
} as const;

/** Hard lock: Strategy Builder cannot open new orders beyond this count. */
export const MAX_ACTIVE_VAULT_POSITIONS = 3;

export const DEFAULT_ACTIVE_PAGE_STEP: ActivePageStep = 1;

export interface Step1BadgeInput {
  vix: number | null | undefined;
  dvol: number | null | undefined;
  defconActive: boolean;
}

export interface Step2BadgeInput {
  label: string | null | undefined;
  markPrice: number | null | undefined;
  funding8hPct: number | null | undefined;
}

export interface Step3BadgeInput {
  strategyLabel: string | null | undefined;
  health: "HEALTHY" | "WARNING" | "CRITICAL" | string;
  liqDistPct: number | null | undefined;
}

export function clampActivePageStep(step: unknown): ActivePageStep {
  const n = Math.max(1, Math.min(4, Number(step) || 1));
  return n as ActivePageStep;
}

export function formatStep1Badge(input: Step1BadgeInput): string {
  const vix =
    input.vix !== null && input.vix !== undefined && Number.isFinite(Number(input.vix))
      ? Number(input.vix).toFixed(1)
      : "--";
  const dvol =
    input.dvol !== null && input.dvol !== undefined && Number.isFinite(Number(input.dvol))
      ? Number(input.dvol).toFixed(1) + "%"
      : "--";
  const defcon = input.defconActive ? "DEFCON: ACTIVE" : "DEFCON: CLEAR";
  return `${defcon} | VIX: ${vix} | DVOL: ${dvol}`;
}

export function formatFunding8hSigned(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return "—";
  const n = Number(pct);
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(4)}%`;
}

export function formatStep2Badge(input: Step2BadgeInput): string {
  const label = (input.label && String(input.label).trim()) || "—";
  const price =
    input.markPrice !== null &&
    input.markPrice !== undefined &&
    Number.isFinite(Number(input.markPrice))
      ? "$" + Number(input.markPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "$—";
  const fr = formatFunding8hSigned(input.funding8hPct);
  return `Active Target: [${label}] ${price} (8h FR: ${fr})`;
}

export function healthEmoji(health: string): string {
  if (health === "CRITICAL") return "🔴";
  if (health === "WARNING") return "🟡";
  return "🟢";
}

export function formatStep3Badge(input: Step3BadgeInput): string {
  const strategy = (input.strategyLabel && String(input.strategyLabel).trim()) || "—";
  const health = input.health || "HEALTHY";
  const dist =
    input.liqDistPct !== null &&
    input.liqDistPct !== undefined &&
    Number.isFinite(Number(input.liqDistPct))
      ? Number(input.liqDistPct).toFixed(1) + "%"
      : "—";
  return `Strategy: ${strategy} | Health: ${healthEmoji(health)} ${health} (Liq Dist: ${dist})`;
}

/** Friendly pair label for the collapsed Step 3 banner */
export function pageStrategyLabel(pairMode: string | null | undefined): string {
  const map: Record<string, string> = {
    spot_long_perp_short: "HL + Spot Arbitrage",
    spot_short_perp_long: "Spot Short + Perp Long",
  };
  if (!pairMode) return "HL + Spot Arbitrage";
  return map[pairMode] || pairMode;
}
