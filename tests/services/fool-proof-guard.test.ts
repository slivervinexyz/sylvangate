import { describe, expect, it } from "vitest";
import {
  FOOL_PROOF_MAX_LEVERAGE,
  FOOL_PROOF_MAX_RETAIL_POSITION_RATIO,
  HL_SESSION_KEY_ALLOWED_CONTRACTS,
  VineShieldRejectedError,
  assertVineShield,
  assertFoolProofGuard,
  checkVineShield,
  checkFoolProofGuard,
  checkFoolProofOrder,
  runVineShieldSoilGate,
  checkSoilResistanceWithFoolProofGuard,
  isAllowedHlSessionAction,
  isAllowedSessionKeyContract,
  resolveEffectiveLeverage,
} from "../../src/services/fool-proof-guard";
import {
  checkSoilResistanceWithVine,
  vineWrapProtection,
  VINE_SOIL_MAX_SLIPPAGE,
} from "../../src/services/risk-control";

const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

const TRIPPED_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 0,
  dydxPerp: 0,
};

describe("checkFoolProofOrder", () => {
  it("hard-rejects fat-finger position > 20% balance for retail", () => {
    const result = checkFoolProofOrder(
      { positionValueUsd: 3_000 },
      10_000,
    );

    expect(result.rejected).toBe(true);
    expect(result.reasons.some((r) => r.startsWith("RETAIL_POSITION"))).toBe(
      true,
    );
  });

  it("allows retail position at exactly 20% of balance", () => {
    const balance = 10_000;
    const result = checkFoolProofOrder(
      {
        positionValueUsd:
          balance * FOOL_PROOF_MAX_RETAIL_POSITION_RATIO,
      },
      balance,
    );

    expect(result.ok).toBe(true);
    expect(result.rejected).toBe(false);
  });

  it("skips retail position cap for institutional profiles", () => {
    const result = checkFoolProofOrder(
      {
        positionValueUsd: 8_000,
        profile: "institutional",
        leverage: 2,
      },
      10_000,
    );

    expect(result.ok).toBe(true);
  });

  it("hard-rejects excessive leverage > 5x", () => {
    const result = checkFoolProofOrder(
      { positionValueUsd: 100, leverage: 6 },
      10_000,
    );

    expect(result.rejected).toBe(true);
    expect(result.reasons.some((r) => r.startsWith("LEVERAGE"))).toBe(true);
  });

  it("infers leverage from position/balance when omitted", () => {
    expect(resolveEffectiveLeverage({ positionValueUsd: 600 }, 100)).toBe(6);

    const result = checkFoolProofOrder({ positionValueUsd: 600 }, 100);
    expect(result.rejected).toBe(true);
    expect(result.reasons).toContain(
      `LEVERAGE=${(600 / 100).toFixed(4)}>${FOOL_PROOF_MAX_LEVERAGE}`,
    );
  });

  it("hard-rejects invalid contract target addresses", () => {
    const result = checkFoolProofOrder(
      {
        positionValueUsd: 50,
        leverage: 1,
        contractTarget: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      },
      10_000,
    );

    expect(result.rejected).toBe(true);
    expect(result.reasons.some((r) => r.startsWith("CONTRACT_TARGET"))).toBe(
      true,
    );
  });

  it("allows Hyperliquid session key zero-address contract target", () => {
    const result = checkFoolProofOrder(
      {
        positionValueUsd: 50,
        leverage: 1,
        contractTarget: HL_SESSION_KEY_ALLOWED_CONTRACTS[0],
      },
      10_000,
    );

    expect(result.ok).toBe(true);
    expect(isAllowedSessionKeyContract(HL_SESSION_KEY_ALLOWED_CONTRACTS[0])).toBe(
      true,
    );
  });

  it("skips position cap for reduce-only orders", () => {
    const result = checkFoolProofOrder(
      { positionValueUsd: 9_000, reduceOnly: true, leverage: 1 },
      10_000,
    );

    expect(result.ok).toBe(true);
  });
});

describe("Vine Shield & vine gates", () => {
  it("assertVineShield throws VineShieldRejectedError on trip", () => {
    expect(() =>
      assertVineShield({
        order: { positionValueUsd: 5_000, leverage: 10 },
        accountBalanceUsd: 10_000,
      }),
    ).toThrow(VineShieldRejectedError);
  });

  it("runVineShieldSoilGate rejects before soil evaluation", () => {
    expect(() =>
      runVineShieldSoilGate(TRIPPED_SOIL, {
        order: { positionValueUsd: 5_000 },
        accountBalanceUsd: 10_000,
      }),
    ).toThrow(VineShieldRejectedError);
  });

  it("runVineShieldSoilGate passes shield then evaluates vine soil", () => {
    const soil = runVineShieldSoilGate(PASSING_SOIL, {
      order: { positionValueUsd: 100, leverage: 1 },
      accountBalanceUsd: 10_000,
    });

    expect(soil.tripped).toBe(false);
    expect(checkVineShield({
      order: { positionValueUsd: 100, leverage: 1 },
      accountBalanceUsd: 10_000,
    }).ok).toBe(true);
  });

  it("checkSoilResistanceWithVine uses 0.3% slippage fuse", () => {
    expect(VINE_SOIL_MAX_SLIPPAGE).toBe(0.003);
    const soil = checkSoilResistanceWithVine({
      symbol: "BTC",
      hlSpot: 50_000,
      hlPerp: 50_200,
      dydxPerp: 50_000,
    });
    expect(soil.tripped).toBe(true);
  });

  it("vineWrapProtection throws on CRI hardlock", () => {
    expect(() =>
      vineWrapProtection({
        symbol: "BTC",
        estimatedLossUsd: 0,
        accountBalanceUsd: 10_000,
        criHardlock: true,
      }),
    ).toThrow();
  });

  it("allows only order|cancel HL session actions (FW-05)", () => {
    expect(isAllowedHlSessionAction("order")).toBe(true);
    expect(isAllowedHlSessionAction("cancel")).toBe(true);
    expect(isAllowedHlSessionAction("withdraw")).toBe(false);
    expect(isAllowedHlSessionAction(undefined)).toBe(false);
  });

  it("deprecated aliases remain wired", () => {
    expect(assertFoolProofGuard).toBe(assertVineShield);
    expect(checkFoolProofGuard).toBe(checkVineShield);
    expect(checkSoilResistanceWithFoolProofGuard).toBe(runVineShieldSoilGate);
  });
});
