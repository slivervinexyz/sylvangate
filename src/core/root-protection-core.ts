/** Vine wrap / root protection — pure throw path (no telemetry I/O). */
import { computeEffectiveMaxSlUsd } from "./dynamic-max-sl";
import { HardlockError, RiskLimitExceeded } from "./errors";
import type { RiskLogPayload } from "./risk-log-types";
import type { RootProtectionInput } from "./risk-log-types";

export type { RootProtectionInput } from "./risk-log-types";

export function vineWrapProtection(input: RootProtectionInput): void {
  const {
    symbol,
    estimatedLossUsd,
    accountBalanceUsd,
    frictionUsd,
    criHardlock = false,
  } = input;
  const maxLossLimit =
    input.maxLossLimit ?? computeEffectiveMaxSlUsd(accountBalanceUsd);
  const loss = Math.abs(estimatedLossUsd);

  if (criHardlock) {
    const context: RiskLogPayload = {
      level: "error",
      module: "risk-control",
      event: "CRI_HARDLOCK",
      symbol,
      timestamp: new Date().toISOString(),
      message:
        "CRI hardlock — vine wrap protection deadlock at 0/100; signing channel blocked",
      details: {
        cri: 0,
        accountBalanceUsd,
        maxLossLimit,
        frictionUsd: frictionUsd ?? null,
        blocked: true,
        httpStatus: 403,
      },
    };
    throw new HardlockError(context.message, context);
  }

  if (loss > maxLossLimit) {
    const context: RiskLogPayload = {
      level: "error",
      module: "risk-control",
      event: "ROOT_PROTECTION_TRIP",
      symbol,
      timestamp: new Date().toISOString(),
      message: `Vine wrap protection — estimated loss $${loss.toFixed(2)} exceeds dynamic Max SL $${maxLossLimit.toFixed(2)}`,
      details: {
        estimatedLossUsd: loss,
        maxLossLimit,
        accountBalanceUsd,
        frictionUsd: frictionUsd ?? null,
        blocked: true,
      },
    };
    throw new RiskLimitExceeded(context.message, context);
  }
}

export const rootProtection = vineWrapProtection;
