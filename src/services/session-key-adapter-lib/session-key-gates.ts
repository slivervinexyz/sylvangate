import {
  R20_LOCKED,
  isR20Locked,
  severSigningChannel,
  type SystemState,
} from "../../core/state";
import { vineWrapProtection } from "../../core/risk";
import { resolveOrderNotionalUsd } from "../../core/session-key-guard-core";
import {
  assertVineShield,
  isAllowedHlSessionAction,
  type HlSessionAction,
  type VineShieldOrder,
} from "../fool-proof-guard";
import {
  DefenseMatrixError,
  PHYSICALLY_SEVERED,
  SESSION_KEY_NOTIONAL_CAP_USD,
  type SessionKeyOrderPayload,
} from "./session-key-types";

/** Derived R20 lock flag — mirrors telemetry `circuitBreakers.r20Locked`. */
export function resolveR20Locked(state: SystemState): boolean {
  return isR20Locked(state);
}

/** Immediately sever the Session Key signing channel (physical hardlock). */
export { severSigningChannel };

function interceptAndSever(reasons: string[]): never {
  severSigningChannel();
  throw new DefenseMatrixError(
    "SESSION_KEY_HARDLOCK_INTERCEPTED",
    "Session Key hardlock intercepted — signing channel severed",
    [PHYSICALLY_SEVERED, ...reasons],
    403,
  );
}

/** Pre-flight physical gates for Session Key order signing. */
export function assertSessionKeyExecutionGates(
  payload: SessionKeyOrderPayload,
  state: SystemState,
  maxPositionUsd?: number,
  foolProof?: Pick<
    VineShieldOrder,
    "leverage" | "contractTarget" | "profile"
  > & { hlAction?: HlSessionAction },
): number {
  const reasons: string[] = [];

  if (!foolProof?.contractTarget?.trim()) {
    reasons.push("CONTRACT_TARGET_REQUIRED");
  }

  if (!isAllowedHlSessionAction(foolProof?.hlAction)) {
    reasons.push("HL_ACTION_INVALID");
  }

  if (state.signingChannelOpen !== true) {
    reasons.push("signingChannelOpen=false");
  }

  if (resolveR20Locked(state)) {
    reasons.push(`${R20_LOCKED}=true`);
    reasons.push(`hardlock=${state.hardlock}`);
    reasons.push(`currentCri=${state.currentCri}`);
  }

  if (reasons.length > 0) {
    interceptAndSever(reasons);
  }

  const orderNotionalUsd = resolveOrderNotionalUsd(payload);

  if (orderNotionalUsd > SESSION_KEY_NOTIONAL_CAP_USD) {
    interceptAndSever([
      `SESSION_CAP=${orderNotionalUsd.toFixed(2)}>${SESSION_KEY_NOTIONAL_CAP_USD}`,
    ]);
  }

  try {
    assertVineShield({
      order: {
        positionValueUsd: orderNotionalUsd,
        reduceOnly: payload.reduceOnly,
        leverage: foolProof?.leverage,
        contractTarget: foolProof?.contractTarget,
        profile: foolProof?.profile,
      },
      accountBalanceUsd: state.accountBalanceUsd,
    });
  } catch (err) {
    interceptAndSever([
      err instanceof Error ? err.message : String(err),
    ]);
  }

  const dynamicMaxSlUsd = state.dynamicMaxSL;
  const positionCap = maxPositionUsd ?? state.accountBalanceUsd;

  if (orderNotionalUsd > dynamicMaxSlUsd) {
    interceptAndSever([
      `ORDER_NOTIONAL=${orderNotionalUsd.toFixed(2)}>dynamicMaxSlUsd=${dynamicMaxSlUsd.toFixed(2)}`,
    ]);
  }

  if (!payload.reduceOnly && orderNotionalUsd > positionCap) {
    interceptAndSever([
      `POSITION_LIMIT=${orderNotionalUsd.toFixed(2)}>maxPositionUsd=${positionCap.toFixed(2)}`,
    ]);
  }

  try {
    vineWrapProtection({
      symbol: `HL_ASSET_${payload.asset}`,
      estimatedLossUsd: orderNotionalUsd,
      accountBalanceUsd: state.accountBalanceUsd,
      criHardlock: state.hardlock,
      maxLossLimit: dynamicMaxSlUsd,
    });
  } catch (err) {
    interceptAndSever([
      err instanceof Error ? err.message : String(err),
    ]);
  }

  return orderNotionalUsd;
}
