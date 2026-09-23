import { describe, expect, it } from "vitest";
import { buildExecutionContext } from "../../../src/adapters/hl/session-key-executor/helpers";
import {
  sanitizeSessionKeyForMasterWalletTrading,
  sessionKeyFromAgentResult,
} from "../../../src/adapters/hl/execution-types";
import { buildPreTradeFromSoilAudit } from "../../../src/data/verified-5tx";
import type { LiveBookSoilAudit } from "../../../src/services/check-soil-resistance";

const MASTER = "0x16762B0DC4BDD84D9aD4720B2BeAF613EE77bcc2";
const DEMO_VAULT = "0x69954204d3c830007b0e564f1ac4b4aa2c828e87";

const SOIL_AUDIT: LiveBookSoilAudit = {
  ok: true,
  tripped: false,
  crossVenueSlippage: 0.0004,
  spotPerpSlippage: 0.0003,
  reasons: [],
  probe: {
    symbol: "ETH",
    bestBid: 3499,
    bestAsk: 3501,
    midPx: 3500,
    bidDepthUsd: 42_000,
    askDepthUsd: 42_000,
    depthUsd: 42_000,
    spreadBps: 5,
    priceImpactBps: 12,
  },
  spreadBps: 5,
  priceImpactBps: 12,
};

describe("session key vault purge", () => {
  it("sanitizeSessionKeyForMasterWalletTrading strips demo vaultAddress", () => {
    const sanitized = sanitizeSessionKeyForMasterWalletTrading(
      {
        agentAddress: "0xabc",
        expiresAt: Date.now() + 60_000,
        masterWalletAddress: MASTER,
        vaultAddress: DEMO_VAULT,
      },
      MASTER,
    );
    expect(sanitized.masterWalletAddress).toBe(MASTER.toLowerCase());
    expect(sanitized.vaultAddress).toBeUndefined();
  });

  it("sessionKeyFromAgentResult never carries vaultAddress", () => {
    const ctx = sessionKeyFromAgentResult(
      {
        action: {
          type: "approveAgent",
          signatureChainId: "0x3e6",
          hyperliquidChain: "Testnet",
          agentAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
          agentName: "BeDeltaAgent",
          nonce: 1,
        },
        signature: "0x" + "ab".repeat(65),
        agentAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        expiresAt: Date.now() + 60_000,
        nonce: 1,
        hyperliquidChain: "Testnet",
      },
      MASTER,
    );
    expect(ctx.masterWalletAddress).toBe(MASTER.toLowerCase());
    expect(ctx.vaultAddress).toBeUndefined();
  });

  it("buildExecutionContext omits vaultAddress from execution session key", () => {
    const ctx = buildExecutionContext(
      {
        signer: { signTypedData: async () => "0x" + "00".repeat(65) },
        sessionKey: {
          agentAddress: "0xabc",
          expiresAt: Date.now() + 60_000,
          masterWalletAddress: MASTER,
          vaultAddress: DEMO_VAULT,
        },
        isTestnet: true,
        dryRun: true,
      },
      {
        accountBalanceUsd: 50_000,
        currentCri: 100,
        signingChannelOpen: true,
        sessionKeyMode: "TRADE_ACTIVE",
        sessionKeyStatus: "OK",
        hardlock: false,
      },
    );
    expect(ctx.sessionKey?.vaultAddress).toBeUndefined();
    expect(ctx.sessionKey?.masterWalletAddress).toBe(MASTER.toLowerCase());
  });

  it("buildPreTradeFromSoilAudit uses HL testnet $5K depth gate", () => {
    const preTrade = buildPreTradeFromSoilAudit(SOIL_AUDIT, 10, 50_000);
    expect(preTrade.isTestnet).toBe(true);
    expect(preTrade.minDepthUsd).toBe(5_000);
    expect(preTrade.depthUsd).toBe(42_000);
  });
});
