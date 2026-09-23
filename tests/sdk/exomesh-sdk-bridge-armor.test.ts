/**
 * SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
 * Copyright 2026 SilverVine Labs
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  assertUnidirectionalBridge,
  ensureSoilWasm,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  verifyAgentIntent,
} from "../../src/sdk";
import {
  clearSoil,
  DIGEST,
  NOW,
  validAttestation,
  validSession,
  WALLET,
} from "./exomesh-sdk-lib/fixtures";

beforeAll(() => {
  expect(ensureSoilWasm()).toBe(true);
});

describe("@slivervine/exomesh-agentic-wallet-guard — bridge & armor", () => {
  it("outbound 46630/4663→42161 ok; inbound AML blocked", () => {
    for (const src of [ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_MAINNET_CHAIN_ID]) {
      const out = assertUnidirectionalBridge({
        sourceChainId: src,
        destChainId: 42161,
        amountUsd: 100,
        wallet: WALLET,
        initiatedAtMs: NOW,
        nowMs: NOW + 1_000,
      });
      expect(out.ok, String(src)).toBe(true);
      expect(out.lostUsd).toBe(0);
      expect(out.inboundToRobinhoodPermitted).toBe(false);
    }
    for (const dest of [ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_MAINNET_CHAIN_ID]) {
      const inbound = assertUnidirectionalBridge({
        sourceChainId: 42161,
        destChainId: dest,
        amountUsd: 10,
        wallet: WALLET,
        initiatedAtMs: NOW,
        nowMs: NOW,
      });
      expect(inbound.ok).toBe(false);
      expect(inbound.capitalLabel).toBe(AML_INBOUND_TO_ROBINHOOD_BLOCKED);
      expect(inbound.reasons).toContain(AML_INBOUND_TO_ROBINHOOD_BLOCKED);
    }
  });

  it("Deadman Switch + RPC/sandwich armor fail-closed", () => {
    const deadman = verifyAgentIntent({
      intentDigest: DIGEST,
      sessionKey: validSession(),
      soil: {
        symbol: "ETH-PERP",
        hlSpot: 100,
        hlPerp: 130,
        dydxPerp: 70,
        depthUsd: 500,
        isTestnet: true,
      },
      deadman: { maxSlippageBps: 5, soilResistanceThreshold: 5 },
      attestation: validAttestation(),
      allowDevBypass: true,
      preset: "production",
      nowMs: NOW,
    });
    expect(deadman.deadmanOk).toBe(false);
    expect(deadman.allowedToSign).toBe(false);
    expect(deadman.reasons).toContain("DEADMAN_SWITCH_TRIPPED");

    const rpcLag = verifyAgentIntent({
      intentDigest: DIGEST,
      sessionKey: validSession(),
      soil: clearSoil(),
      armor: { rpcLatencyMs: 500 },
      attestation: validAttestation(),
      allowDevBypass: true,
      preset: "production",
      nowMs: NOW,
    });
    expect(rpcLag.armorOk).toBe(false);
    expect(rpcLag.reasons.some((r) => r.startsWith("AGENT_ARMOR_RPC_LAG"))).toBe(true);

    const sandwich = verifyAgentIntent({
      intentDigest: DIGEST,
      sessionKey: validSession(),
      soil: clearSoil(),
      armor: { sandwichRiskBps: 80 },
      attestation: validAttestation(),
      allowDevBypass: true,
      preset: "production",
      nowMs: NOW,
    });
    expect(sandwich.armorOk).toBe(false);
    expect(sandwich.reasons.some((r) => r.startsWith("AGENT_ARMOR_SANDWICH_RISK"))).toBe(true);
  });
});
