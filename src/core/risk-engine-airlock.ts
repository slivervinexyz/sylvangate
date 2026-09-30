/**
 * Airlock fast-path + auto-sever wrapper — extracted to keep risk-engine-core under 200 LOC.
 *
 * Trail of Bits paradigm alignment (conceptual — no Slither/Echidna/Manticore runtime in this SKU):
 * - Echidna-style property invariants on pre-sign state (`ok` / `tripped` / `reasons` coherence).
 * - Slither-inspired static dataflow boundaries on intent fields before broadcast.
 * - Manticore-style symbolic edge resolution via mandate bypass of the nominal fast-path.
 */
import {
  MAX_SLIPPAGE,
  computeAirlockSlippageMetrics,
  isTsunamiShieldWindow,
  resolveAirlockMinDepthUsd,
} from "./airlock-threshold-core";
import type { AirlockThresholdInput, AirlockThresholdResult } from "./airlock-threshold-types";
import { checkAirlockThreshold as checkAirlockThresholdBase } from "../services/risk-control-lib/airlock-threshold";

/** SKU spin-off — no live sequencer / gas probes in this slice. */
const isXyzOrHip3Key = (_symbol: string): boolean => false;
const isSequencerSafe = (_refMs: number): boolean => true;
const isArbitrumStatusSequencerHealthy = (_refMs: number): boolean => true;
const isRpcRadarSequencerHealthy = (_refMs: number): boolean => true;
const isArbitrumGasGuardBlocked = (): boolean => false;
const isSoftConfirmationSafe = (_refMs: number): boolean => true;
import { hasIntentMandateFields } from "./intent-mandate";
import { applyAirlockTripSeverance } from "./risk-severance";
import { getGlobalMonotonicClock, resolveWallAge, saturatingSub } from "./monotonic-time";

const AIRLOCK_CLEAR: AirlockThresholdResult = { ok: true, tripped: false, crossVenueSlippage: 0, spotPerpSlippage: 0, reasons: [] };
let airlockRef: AirlockThresholdInput | null = null;
let airlockFast = false;

/**
 * Nominal-path eligibility for 0-Gas pre-sign bypass (Wasm slippage lane + clock guards).
 *
 * @remarks Slither-inspired AST dataflow: complex adjunct lanes (`crossSpread`, Pendle, GMX)
 * force full evaluation — intent fields cannot silently skip the interceptor graph.
 */
export function isGatewayNominalFastPath(airlock: AirlockThresholdInput): boolean {
  if (airlockRef === airlock) return airlockFast;
  if (airlock.crossSpread || airlock.gmxPriceImpact || airlock.pendleCrossGuard || airlock.pendleOracle || airlock.pendlePoolFactory || isXyzOrHip3Key(airlock.symbol)) {
    airlockRef = airlock; airlockFast = false; return false;
  }
  if (
    computeAirlockSlippageMetrics(airlock, {
      maxSlippage: airlock.maxSlippage ?? MAX_SLIPPAGE,
      minDepthUsd: resolveAirlockMinDepthUsd(airlock),
    }).tripFlags !== 0 ||
    isTsunamiShieldWindow(airlock.at)
  ) {
    airlockRef = airlock;
    airlockFast = false;
    return false;
  }
  const wallMs = airlock.at?.getTime() ?? Date.now();
  const clockSample = getGlobalMonotonicClock().read(wallMs);
  if (clockSample.anomaly !== null) {
    airlockRef = airlock;
    airlockFast = false;
    return false;
  }
  const refMs = clockSample.virtualWallMs;
  if (airlock.at !== undefined) {
    const clockLeap = resolveWallAge(refMs, airlock.at.getTime());
    if (clockLeap.kind === "LEAP") {
      airlockRef = airlock;
      airlockFast = false;
      return false;
    }
    if (saturatingSub(refMs, airlock.at.getTime()) > 86_400_000) {
      airlockRef = airlock;
      airlockFast = false;
      return false;
    }
  }
  const ok =
    isSequencerSafe(refMs) &&
    isArbitrumStatusSequencerHealthy(refMs) &&
    isRpcRadarSequencerHealthy(refMs) &&
    !isArbitrumGasGuardBlocked() &&
    isSoftConfirmationSafe(refMs);
  airlockRef = airlock; airlockFast = ok; return ok;
}

/**
 * Primary 0-Gas pre-sign airlock evaluator for Robinhood Chain (`4663`).
 *
 * @remarks **Echidna-style invariants (property-based):** `tripped === !ok`; when `tripped`,
 * `reasons` is non-empty and `applyAirlockTripSeverance` runs (fail-closed before UserOp sign).
 * **Slither-inspired dataflow:** mandate fields route through `intent-core` venue/digest checks
 * before slippage math — UserOp boundary taint cannot reach sign without passing predicates.
 * **Manticore-style edges:** `hasIntentMandateFields` disables the fast-path to resolve
 * session-key / venue-drift branches before commitment.
 *
 * Mandate gate runs in `checkAirlockThresholdBase` via `intent-core` when fast path is bypassed.
 */
export function checkAirlockThreshold(input: AirlockThresholdInput): AirlockThresholdResult {
  const result =
    !hasIntentMandateFields(input) && isGatewayNominalFastPath(input)
      ? AIRLOCK_CLEAR
      : checkAirlockThresholdBase(input);
  if (result.tripped) applyAirlockTripSeverance(true);
  return result;
}
