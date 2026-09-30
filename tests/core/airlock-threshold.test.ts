import { describe, expect, it } from "vitest";
import { checkAirlockThreshold } from "../../src/core/risk-engine-airlock";
import { validateFhenixEncryptedAirlock } from "../../src/core/fhenix-encrypted-airlock";
import {
  USDG_TOKEN_ADDRESS,
  validateUSDGAirlockPolicy,
} from "../../src/core/usdg-airlock-policy";
import { readStateOverride } from "../../src/core/state-store";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../../src/sdk/constants";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

describe("airlock-threshold-4663 Blueprint 4 complement", () => {
  it("trips Pons launchpad trap on chain 4663 and severs signing channel", () => {
    const verdict = checkAirlockThreshold({
      symbol: "PONS",
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      agentId: "grok-bot-sim",
      orderSizeUsd: 1000,
      maxSlippage: 0.01,
      hlSpot: 1.0,
      hlPerp: 1.0,
      dydxPerp: 1.15,
      depthUsd: 50_000,
      at: SAFE_TRADING_TIME,
    });
    expect(verdict.tripped).toBe(true);
    expect(verdict.reasons.length).toBeGreaterThan(0);
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
  });

  it("should validate confidential agent intent using Fhenix FHE payload envelope", () => {
    expect(
      validateFhenixEncryptedAirlock({
        encryptedPayload: "0xenc-agent-intent",
        fheThresholdProof: "0xfhe-threshold-proof",
      }),
    ).toBe(true);
    expect(validateFhenixEncryptedAirlock({ encryptedPayload: "", fheThresholdProof: "0xfhe-x" })).toBe(false);
    expect(
      validateFhenixEncryptedAirlock({ encryptedPayload: "0xenc", fheThresholdProof: "0xdead" }),
    ).toBe(false);
    expect(
      validateFhenixEncryptedAirlock({ encryptedPayload: "0xenc", fheThresholdProof: "" }),
    ).toBe(false);
  });

  it("should enforce 0-Gas Pre-Sign Airlock on Paxos USDG UserOp payloads", () => {
    expect(
      validateUSDGAirlockPolicy({
        chainId: ROBINHOOD_MAINNET_CHAIN_ID,
        tokenAddress: USDG_TOKEN_ADDRESS,
        intentKind: "transfer",
      }),
    ).toBe(true);
    expect(
      validateUSDGAirlockPolicy({
        chainId: ROBINHOOD_MAINNET_CHAIN_ID,
        tokenAddress: USDG_TOKEN_ADDRESS,
        intentKind: "permit2",
      }),
    ).toBe(true);
    expect(
      validateUSDGAirlockPolicy({
        chainId: ROBINHOOD_MAINNET_CHAIN_ID,
        tokenAddress: USDG_TOKEN_ADDRESS,
      }),
    ).toBe(true);
    expect(
      validateUSDGAirlockPolicy({
        chainId: 42161,
        tokenAddress: USDG_TOKEN_ADDRESS,
        intentKind: "userOp",
      }),
    ).toBe(false);
    expect(
      validateUSDGAirlockPolicy({
        chainId: ROBINHOOD_MAINNET_CHAIN_ID,
        tokenAddress: "0x0000000000000000000000000000000000000001",
        intentKind: "userOp",
      }),
    ).toBe(false);
  });
});
