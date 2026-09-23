/**
 * Shared adapter SystemState circuit-breaker gates.
 */

import { R20_LOCKED, isR20Locked, type SystemState } from "./state";
import {
  HardlockError,
  RiskLimitExceeded,
  vineWrapProtection,
} from "./risk";

export interface DefenseMatrixErrorLike {
  readonly code: string;
  readonly httpStatus: number;
  readonly reasons: string[];
}

export interface DefenseMatrixErrorConstructor {
  new (
    code: string,
    message: string,
    reasons?: string[],
    httpStatus?: number,
  ): Error & DefenseMatrixErrorLike;
}

export interface AssertSystemStateGatesOptions {
  adapterName: string;
  symbol: string;
  /** Error code when signing channel is closed (default: SIGNING_CHANNEL_CLOSED) */
  signingChannelClosedCode?: string;
}

/** Assert SystemState circuit breakers before any venue adapter evaluation. */
export function assertSystemStateGates(
  state: SystemState,
  amountUsd: number,
  DefenseMatrixError: DefenseMatrixErrorConstructor,
  options: AssertSystemStateGatesOptions,
): void {
  const { adapterName, symbol } = options;
  const signingClosedCode = options.signingChannelClosedCode ?? "SIGNING_CHANNEL_CLOSED";

  if (isR20Locked(state) || state.hardlock) {
    throw new DefenseMatrixError(
      R20_LOCKED,
      `${R20_LOCKED} — ${adapterName} adapter blocked; signing channel severed`,
      [
        `hardlock=${state.hardlock}`,
        `currentCri=${state.currentCri}`,
        `signingChannelOpen=${state.signingChannelOpen}`,
      ],
      403,
    );
  }

  if (!state.signingChannelOpen) {
    throw new DefenseMatrixError(
      signingClosedCode,
      `${adapterName} adapter blocked — signing channel closed`,
      [`signingChannelOpen=false`],
      403,
    );
  }

  try {
    vineWrapProtection({
      symbol,
      estimatedLossUsd: amountUsd,
      accountBalanceUsd: state.accountBalanceUsd,
      criHardlock: state.hardlock,
    });
  } catch (err) {
    if (err instanceof HardlockError) {
      throw new DefenseMatrixError(
        R20_LOCKED,
        err.message,
        [err.message],
        403,
      );
    }
    if (err instanceof RiskLimitExceeded) {
      throw new DefenseMatrixError(
        "ROOT_PROTECTION",
        err.message,
        [err.message],
        422,
      );
    }
    throw err;
  }
}
