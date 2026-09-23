import { afterEach, describe, expect, it } from "vitest";
import { checkSoilResistance } from "../src/services/risk-control";
import {
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
  evaluateGasSurcharge,
  evaluateOracleLag,
  estimateL1SurchargeWei,
  refreshArbitrumGasGuard,
} from "../src/services/risk/arbitrum-gas-guard";

afterEach(() => {
  __resetArbitrumGasGuardForTests();
});

function u256(v: bigint): string {
  return `0x${v.toString(16).padStart(64, "0")}`;
}

function roundData(answer: bigint, updatedAtSec: number): string {
  const p = (n: bigint) => n.toString(16).padStart(64, "0");
  return `0x${p(1n)}${p(answer)}${p(0n)}${p(BigInt(updatedAtSec))}`;
}

describe("arbitrum-gas-guard", () => {
  it("evaluateGasSurcharge blocks when L1 cost > 30% target yield", () => {
    const v = evaluateGasSurcharge(0.05, 0.1);
    expect(v.blocked).toBe(true);
    expect(v.reason).toMatch(/ARBITRUM_GAS_SURCHARGE/);
  });

  it("evaluateOracleLag triggers ORACLE_LAG_DEADLOCK above 30000ms", () => {
    const v = evaluateOracleLag(1_000, 31_001);
    expect(v.deadlock).toBe(true);
    expect(v.reason).toBe("ORACLE_LAG_DEADLOCK:30001ms>30000ms");
  });

  it("refreshArbitrumGasGuard decodes L1 base fee + oracle lag", async () => {
    const nowSec = 1_700_000_000;
    const state = await refreshArbitrumGasGuard({
      now: () => nowSec * 1000,
      targetYieldUsd: 10,
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { id?: string };
        if (body.id === "l1") {
          return new Response(JSON.stringify({ result: u256(25_000_000_000n) }), { status: 200 });
        }
        if (body.id === "oracle") {
          return new Response(
            JSON.stringify({ result: roundData(3_000_000_000_000n, nowSec - 700) }),
            { status: 200 },
          );
        }
        if (body.id === "block") {
          return new Response(
            JSON.stringify({ result: { timestamp: `0x${nowSec.toString(16)}` } }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ result: "0x0" }), { status: 200 });
      },
    });
    expect(state.l1BaseFeeWei).toBe(25_000_000_000n);
    expect(state.oracleLagDeadlock).toBe(true);
    expect(state.reason).toContain("ORACLE_LAG_DEADLOCK");
    expect(estimateL1SurchargeWei(state.l1BaseFeeWei)).toBeGreaterThan(0n);
  });

  it("checkSoilResistance trips when gas guard cache blocked", () => {
    __setArbitrumGasGuardForTests({
      l1BaseFeeWei: 1n,
      l1SurchargeWei: 1n,
      l1SurchargeUsd: 1,
      targetYieldUsd: 0.01,
      gasYieldRatio: 100,
      gasBlocked: true,
      oracleUpdatedAtMs: 0,
      l2BlockTimestampMs: 0,
      oracleLagMs: 0,
      oracleLagDeadlock: false,
      reason: "ARBITRUM_GAS_SURCHARGE:100.0%>30%",
      fetchedAtMs: Date.now(),
    });
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3500,
      depthUsd: 200_000,
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes("ARBITRUM_GAS_SURCHARGE"))).toBe(true);
  });
});
