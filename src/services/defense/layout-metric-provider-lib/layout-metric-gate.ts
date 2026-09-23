import { vineWrapProtection, type RootProtectionInput } from "../../risk-control";
import {
  computeLayoutBoundUsd,
  readLayoutMetricEnv,
  resolveLayoutMetricThresholds,
  type LayoutMetricConfig,
} from "./layout-metric-unlock";

export function enforceLayoutMetricGate(
  input: Omit<RootProtectionInput, "maxLossLimit">,
  env?: LayoutMetricConfig,
): void {
  const cfg = readLayoutMetricEnv(env);
  const thresholds = resolveLayoutMetricThresholds(cfg);
  vineWrapProtection({
    ...input,
    maxLossLimit: computeLayoutBoundUsd(input.accountBalanceUsd, thresholds),
  });
}
