import { HardlockError, RiskLimitExceeded } from "../../core/errors";
import { vineWrapProtection as vineWrapProtectionCore } from "../../core/root-protection-core";
import type { RootProtectionInput } from "../../core/risk-log-types";
import { computeEffectiveMaxSlUsd } from "../effective-max-sl";
import { severCircuitBreakerPipeline } from "../root-protection-lib/circuit-breaker-sever";
import { notifyFailClosedLock } from "../telemetry/telegram-alert";
import { emitRiskLog } from "./logging";

export type { RootProtectionInput } from "../../core/risk-log-types";
export { HardlockError, RiskLimitExceeded } from "../../core/errors";

export function vineWrapProtection(input: RootProtectionInput): void {
  try {
    vineWrapProtectionCore(input);
  } catch (err) {
    if (err instanceof HardlockError) {
      emitRiskLog(err.context);
      severCircuitBreakerPipeline("R20");
      throw err;
    }
    if (err instanceof RiskLimitExceeded) {
      emitRiskLog(err.context);
      const loss = Math.abs(input.estimatedLossUsd);
      const maxLossLimit = input.maxLossLimit ?? computeEffectiveMaxSlUsd(input.accountBalanceUsd);
      notifyFailClosedLock(
        `rootProtection() TRIP ${input.symbol} — loss $${loss.toFixed(2)} > Max SL $${maxLossLimit.toFixed(2)} (hot-key lock)`,
      );
      throw err;
    }
    throw err;
  }
}

export const rootProtection = vineWrapProtection;
