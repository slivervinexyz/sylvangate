/**
 * Pendle Yield Shield — Option 3: Agentic Auto-Roll Safety Gate.
 * 0-Gas pre-consensus gate for AI agents executing PT/YT roll actions.
 */
import { resolvePendlePtRegistryEntry } from "../../../adapters/pendle/pendle-pt-registry";
import {
  evaluatePendlePtExpiryRisk,
  PENDLE_IMPLICIT_YIELD_JITTER_FAIL_BPS,
} from "../../../adapters/pendle/pendle-pt-expiry-guard";
import {
  hashKeyToSlotIndex,
  resetIntentRingSlab,
  slotBaseOffset,
  trackAttemptBudgetU32Pure,
} from "../../../core/intent-core-ring";
import { INTENT_RING_U32 } from "../../../core/intent-core-buffers";
import { INTENT_MAX_ATTEMPTS_DEFAULT, INTENT_SLOT_ATTEMPTS } from "../../../core/wasm-intent-ffi";

export const PENDLE_ROLL_ACTIONS = [
  "PT_ROLL_FORWARD",
  "YT_SELL_AND_ROLL",
  "PT_MERGE_AND_ROLL",
] as const;

export type PendleRollAction = (typeof PENDLE_ROLL_ACTIONS)[number];

export const ROLL_GATE_CODES = {
  UNKNOWN_SOURCE_MARKET: "UNKNOWN_SOURCE_MARKET",
  UNKNOWN_TARGET_MARKET: "UNKNOWN_TARGET_MARKET",
  ROLL_BACKWARD_REJECTED: "ROLL_BACKWARD_REJECTED",
  YIELD_DRIFT_REJECTED: "YIELD_DRIFT_REJECTED",
  EXPIRY_FAIL_CLOSED: "EXPIRY_FAIL_CLOSED",
  HALLUCINATED_AMOUNT: "HALLUCINATED_AMOUNT",
  MAX_ATTEMPTS_EXCEEDED_SEVERED: "MAX_ATTEMPTS_EXCEEDED_SEVERED",
} as const;

export interface AgenticRollParams {
  action: PendleRollAction;
  agentId: string;
  sourceMarketKeyOrAddress: string;
  targetMarketKeyOrAddress: string;
  rollAmountPt: number;
  agentImpliedYieldBps: number;
  oracleImpliedYieldBps: number;
  chainId?: number;
  nowMs?: number;
}

export interface AgenticRollVerdict {
  passed: boolean;
  zeroGasBlocked: boolean;
  code?: keyof typeof ROLL_GATE_CODES;
  message?: string;
  attempts: number;
  channelSevered: boolean;
  yieldDriftBps: number;
  daysToTargetMaturity: number;
}

let rollChannelSevered = false;

export function __resetAgenticRollGateForTests(): void {
  rollChannelSevered = false;
  resetIntentRingSlab();
}

function rollRingOffset(agentId: string, sourceMarket: string): number {
  const key = `pendle-roll:${agentId.trim().toLowerCase()}:${sourceMarket.trim().toLowerCase()}`;
  return slotBaseOffset(hashKeyToSlotIndex(key));
}

function trackRollAttempt(agentId: string, sourceMarket: string): {
  allowed: boolean;
  attempts: number;
  severChannel: boolean;
} {
  if (rollChannelSevered) {
    return { allowed: false, attempts: INTENT_MAX_ATTEMPTS_DEFAULT, severChannel: true };
  }
  const off = rollRingOffset(agentId, sourceMarket);
  const budget = trackAttemptBudgetU32Pure(off, INTENT_MAX_ATTEMPTS_DEFAULT);
  if (budget.severChannel) rollChannelSevered = true;
  return {
    allowed: budget.allowed,
    attempts: INTENT_RING_U32[off + INTENT_SLOT_ATTEMPTS] ?? 0,
    severChannel: budget.severChannel,
  };
}

/** Pre-consensus 0-Gas safety gate — blocks hallucinated roll params and retry storms. */
export function evaluateAgenticAutoRollGate(
  params: AgenticRollParams,
): AgenticRollVerdict {
  const nowMs = params.nowMs ?? Date.now();
  const yieldDriftBps = Math.abs(
    params.agentImpliedYieldBps - params.oracleImpliedYieldBps,
  );

  const attempt = trackRollAttempt(params.agentId, params.sourceMarketKeyOrAddress);
  if (!attempt.allowed) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: "MAX_ATTEMPTS_EXCEEDED_SEVERED",
      message: `MAX_ATTEMPTS_EXCEEDED_SEVERED:attempts=${attempt.attempts}`,
      attempts: attempt.attempts,
      channelSevered: attempt.severChannel,
      yieldDriftBps,
      daysToTargetMaturity: 0,
    };
  }

  const source = resolvePendlePtRegistryEntry(params.sourceMarketKeyOrAddress);
  if (!source) {
    return failRoll(ROLL_GATE_CODES.UNKNOWN_SOURCE_MARKET, attempt.attempts, yieldDriftBps, 0);
  }
  const target = resolvePendlePtRegistryEntry(params.targetMarketKeyOrAddress);
  if (!target) {
    return failRoll(ROLL_GATE_CODES.UNKNOWN_TARGET_MARKET, attempt.attempts, yieldDriftBps, 0);
  }

  if (target.expirySec <= source.expirySec) {
    return failRoll(ROLL_GATE_CODES.ROLL_BACKWARD_REJECTED, attempt.attempts, yieldDriftBps, 0);
  }

  if (!Number.isFinite(params.rollAmountPt) || params.rollAmountPt <= 0) {
    return failRoll(ROLL_GATE_CODES.HALLUCINATED_AMOUNT, attempt.attempts, yieldDriftBps, 0);
  }

  if (yieldDriftBps > PENDLE_IMPLICIT_YIELD_JITTER_FAIL_BPS) {
    return failRoll(ROLL_GATE_CODES.YIELD_DRIFT_REJECTED, attempt.attempts, yieldDriftBps, 0);
  }

  const expiry = evaluatePendlePtExpiryRisk(
    target.expirySec,
    yieldDriftBps,
    nowMs,
  );
  if (expiry.failClosed) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: "EXPIRY_FAIL_CLOSED",
      message: expiry.reasons.join("|"),
      attempts: attempt.attempts,
      channelSevered: false,
      yieldDriftBps,
      daysToTargetMaturity: expiry.daysToMaturity,
    };
  }

  return {
    passed: true,
    zeroGasBlocked: false,
    attempts: attempt.attempts,
    channelSevered: false,
    yieldDriftBps,
    daysToTargetMaturity: expiry.daysToMaturity,
  };
}

function failRoll(
  code: keyof typeof ROLL_GATE_CODES,
  attempts: number,
  yieldDriftBps: number,
  daysToTargetMaturity: number,
): AgenticRollVerdict {
  return {
    passed: false,
    zeroGasBlocked: true,
    code,
    message: ROLL_GATE_CODES[code],
    attempts,
    channelSevered: false,
    yieldDriftBps,
    daysToTargetMaturity,
  };
}
