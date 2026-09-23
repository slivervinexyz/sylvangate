import { computeEffectiveMaxSlUsd } from "../../src/services/risk-control";

export const TEST_BALANCE_USD = 10_000;
export const TEST_MAX_SL = computeEffectiveMaxSlUsd(TEST_BALANCE_USD); // 10000 * 0.01 + 100 = 200
