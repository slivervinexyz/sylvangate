/** Global risk policy orchestration — extracted to keep risk-engine-core <200 LOC. */
import { R20_LOCKED, readActiveSystemState } from "./state";
import { checkFoolProofGuard } from "../services/fool-proof-guard";
import { evaluateFundingRegimePolicy } from "./funding-regime-policy-core";
import { HardlockError, RiskLimitExceeded } from "./errors";
import { isR20Locked } from "./risk";
import { vineWrapProtection } from "./root-protection-core";
import type { GlobalRiskPolicyResult, RiskIntent } from "./risk-engine-lib/risk-engine-types";
import { deny } from "./risk-engine-lib/risk-engine-types";
import { checkSoilResistance } from "./risk-engine-soil";

export function evaluateGlobalRiskPolicy(intent: RiskIntent): GlobalRiskPolicyResult {
  const state = intent.systemState ?? readActiveSystemState();
  const funding = intent.funding ? evaluateFundingRegimePolicy({ ...intent.funding, symbol: intent.funding.symbol ?? intent.symbol, baseNotionalUsd: intent.funding.baseNotionalUsd ?? intent.amountUsd, requestedLeverage: intent.funding.requestedLeverage ?? intent.foolProof?.leverage }) : null;
  if (isR20Locked(state)) return deny(`${R20_LOCKED} — signing channel severed`, 403);
  try {
    vineWrapProtection({ symbol: intent.symbol ?? intent.venue, estimatedLossUsd: intent.amountUsd, accountBalanceUsd: state.accountBalanceUsd, criHardlock: state.hardlock });
  } catch (err) {
    if (err instanceof HardlockError || err instanceof RiskLimitExceeded) return deny(err.message, err instanceof HardlockError ? 403 : 422);
    throw err;
  }
  if (funding?.r20Triggered || (funding && !funding.rebalanceAllowed)) {
    return { isAllowed: false, reason: funding.reasons.join("|") || "FUNDING_REGIME_HALT", suggestedHttpCode: 403, fundingRegime: funding.regime, targetLeverage: funding.targetLeverage, scaledNotionalUsd: funding.scaledNotionalUsd };
  }
  if (funding && intent.foolProof?.leverage !== undefined && funding.reasons.some((r) => r.startsWith("FUNDING_LEVERAGE_CAP"))) {
    return { isAllowed: false, reason: funding.reasons.join("|"), suggestedHttpCode: 422, fundingRegime: funding.regime, targetLeverage: funding.targetLeverage, scaledNotionalUsd: funding.scaledNotionalUsd };
  }
  const fool = checkFoolProofGuard({ order: { positionValueUsd: intent.amountUsd, leverage: intent.foolProof?.leverage, contractTarget: intent.foolProof?.contractTarget, profile: intent.foolProof?.profile, reduceOnly: intent.foolProof?.reduceOnly }, accountBalanceUsd: state.accountBalanceUsd });
  if (fool.rejected) return deny(`Fool-proof guard rejected — ${fool.reasons.join("|")}`, 422);
  if (intent.soil) {
    const soil = checkSoilResistance(intent.soil);
    if (soil.tripped) return deny(`Soil resistance tripped — ${soil.reasons.join("|")}`, 422);
  }
  return { isAllowed: true, fundingRegime: funding?.regime, targetLeverage: funding?.targetLeverage, scaledNotionalUsd: funding?.scaledNotionalUsd };
}
