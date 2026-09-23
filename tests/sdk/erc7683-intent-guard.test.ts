import { describe, expect, it } from "vitest";
import {
  computeCrossChainExecutionDeltaBps,
  ERC7683_CODES,
  evaluateErc7683CrossChainIntentGuard,
} from "../../src/sdk/exomesh-agentic-wallet-guard/erc7683-intent-guard";

const VALID_ORDER = {
  originChainId: 42161,
  destinationChainId: 10,
  inputAmount: 1_000_000n,
  minOutputAmount: 999_500n,
  quotedOutputAmount: 1_000_000n,
  solverFeeBps: 5,
  maxSlippageBps: 50,
  deadlineSec: 9_999_999_999,
  nowSec: 1_700_000_000,
};

describe("erc7683-intent-guard", () => {
  it("PASS — valid cross-chain order within slippage budget", () => {
    const verdict = evaluateErc7683CrossChainIntentGuard(VALID_ORDER);
    expect(verdict.passed).toBe(true);
    expect(verdict.zeroGasBlocked).toBe(false);
    expect(verdict.executionDeltaBps).toBeLessThanOrEqual(50);
    expect(verdict.evalLatencyUs).toBeLessThan(10_000);
  });

  it("REJECT — suspicious solver MEV / slippage overshoot", () => {
    const verdict = evaluateErc7683CrossChainIntentGuard({
      ...VALID_ORDER,
      minOutputAmount: 1_000_000n,
      quotedOutputAmount: 900_000n,
      solverFeeBps: 40,
      maxSlippageBps: 20,
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.zeroGasBlocked).toBe(true);
    expect(verdict.code).toBe(ERC7683_CODES.SLIPPAGE_OVERSHOOT);
    expect(computeCrossChainExecutionDeltaBps({
      ...VALID_ORDER,
      minOutputAmount: 1_000_000n,
      quotedOutputAmount: 900_000n,
    })).toBeGreaterThan(20);
  });

  it("REJECT — soil Wasm lane trip blocks cross-chain intent", () => {
    const verdict = evaluateErc7683CrossChainIntentGuard({ ...VALID_ORDER, solverFeeBps: 0 }, {
      hlSpot: 100,
      hlPerp: 120,
      dydxPerp: 80,
      depthUsd: 1_000,
      maxSlippage: 0.001,
      minDepthUsd: 500_000,
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.code).toBe(ERC7683_CODES.SOIL_TRIP);
  });
});
