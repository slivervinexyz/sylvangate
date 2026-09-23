import { describe, expect, it } from "vitest";
import {
  HL_APPROVE_AGENT_TYPES,
  HL_EXCHANGE_DOMAIN,
  HL_HYPEREVM_TESTNET_CHAIN_HEX,
  HL_SESSION_KEY_AGENT_NAME,
  buildUserSignedDomain,
  createL1ActionHash,
} from "../../../src/adapters/hl/auth";
import { floatToWire } from "../../../src/adapters/hl/execution-wire";
import { buildSessionAgentMarketOrderWire } from "../../../src/adapters/hl/wallet/sessionOrderWire";

describe("hl SDK alignment — approveAgent EIP-712", () => {
  it("uses HyperliquidSignTransaction domain with wallet signatureChainId (not Exchange/1337)", () => {
    const domain = buildUserSignedDomain(HL_HYPEREVM_TESTNET_CHAIN_HEX);
    expect(domain).toEqual({
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 998,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    });
    expect(HL_APPROVE_AGENT_TYPES["HyperliquidTransaction:ApproveAgent"]).toEqual([
      { name: "hyperliquidChain", type: "string" },
      { name: "agentAddress", type: "address" },
      { name: "agentName", type: "string" },
      { name: "nonce", type: "uint64" },
    ]);
    expect(HL_SESSION_KEY_AGENT_NAME).toBe("BeDeltaAgent");
  });
});

describe("hl SDK alignment — L1 order action", () => {
  it("builds IoC market order wire with floatToWire p/s and grouping na (no vaultAddress)", () => {
    const plan = buildSessionAgentMarketOrderWire({
      asset: 0,
      isBuy: true,
      notionalUsd: 12,
      limitPx: 100,
      szDecimals: 4,
    });

    expect(plan.action).toEqual({
      type: "order",
      orders: [plan.wire],
      grouping: "na",
    });
    expect(plan.wire).toMatchObject({
      a: 0,
      b: true,
      p: floatToWire(plan.limitPx),
      s: floatToWire(plan.size),
      r: false,
      t: { limit: { tif: "Ioc" } },
    });
    expect("vaultAddress" in plan.action).toBe(false);
  });

  it("L1 action hash uses vault marker 0x00 when vaultAddress omitted", () => {
    const action = { type: "order", orders: [], grouping: "na" };
    const nonce = 1_700_000_000_000;
    const withVault = createL1ActionHash({
      action,
      nonce,
      vaultAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    });
    const withoutVault = createL1ActionHash({ action, nonce });
    expect(withVault).not.toBe(withoutVault);
    expect(HL_EXCHANGE_DOMAIN.chainId).toBe(1337);
  });
});
