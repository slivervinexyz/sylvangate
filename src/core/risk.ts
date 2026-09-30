/** SKU risk barrel — funding stubs + airlock threshold re-export. */
export type { AirlockThresholdInput, AirlockThresholdResult } from "./airlock-threshold-types";

export interface FundingRegimePolicyInput {
  symbol?: string;
}

export function evaluateFundingRegimePolicy(_input: FundingRegimePolicyInput): { regime: "neutral" } {
  return { regime: "neutral" };
}
