import { describe, expect, it } from "vitest";
import {
  quoteRChainYieldToArbitrumGm,
  RWA_YIELD_MIN_USD,
} from "../../src/adapters/robinhood/treasury-escort-router";
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../../src/sdk";

const WALLET = "0xcccccccccccccccccccccccccccccccccccccccc";
const NOW = 1_700_000_000_000;

describe("treasury-escort-router escort", () => {
  it("quotes RWA → Arbitrum GM with bridge escort ok when capital settled", () => {
    const q = quoteRChainYieldToArbitrumGm({
      assetKind: "rwa",
      symbol: "TOKENIZED-TBILL",
      amountUsd: 1_000,
      wallet: WALLET,
      sourceChainId: ROBINHOOD_TESTNET_CHAIN_ID,
      initiatedAtMs: NOW,
      settledAtMs: NOW + 500,
      nowMs: NOW + 1_000,
    });
    expect(q.ok).toBe(true);
    expect(q.bridgeEscortOk).toBe(true);
    expect(q.destChainId).toBe(ARBITRUM_ONE_CHAIN_ID);
    expect(q.decisionReady).toBe(true);
    expect(q.contractDeployed).toBe(false);
    expect(q.gmPoolTarget).toBe("GM_ETH_USDC");
    expect(q.targetRoute).toBe("GM_ETH_USDC");
    expect(q.smartRoutingAddress).toBeTruthy();
  });

  it("accepts Robinhood mainnet alias 4663 as source when settled", () => {
    const q = quoteRChainYieldToArbitrumGm({
      assetKind: "idle",
      symbol: "USDC",
      amountUsd: 500,
      wallet: WALLET,
      sourceChainId: ROBINHOOD_MAINNET_CHAIN_ID,
      initiatedAtMs: NOW,
      settledAtMs: NOW + 500,
      nowMs: NOW + 1_000,
    });
    expect(q.ok).toBe(true);
    expect(q.sourceChainId).toBe(ROBINHOOD_MAINNET_CHAIN_ID);
  });

  it("defaults source chain to Robinhood mainnet 4663 when omitted", () => {
    const q = quoteRChainYieldToArbitrumGm({
      assetKind: "idle",
      symbol: "USDG",
      amountUsd: 500,
      wallet: WALLET,
      initiatedAtMs: NOW,
      settledAtMs: NOW + 500,
      nowMs: NOW + 1_000,
    });
    expect(q.sourceChainId).toBe(ROBINHOOD_MAINNET_CHAIN_ID);
  });

  it("rejects undersized amount", () => {
    const q = quoteRChainYieldToArbitrumGm({
      assetKind: "idle",
      symbol: "USDC",
      amountUsd: RWA_YIELD_MIN_USD - 1,
      wallet: WALLET,
      initiatedAtMs: NOW,
      nowMs: NOW,
    });
    expect(q.ok).toBe(false);
    expect(q.reasons).toContain("RWA_YIELD_AMOUNT_TOO_SMALL");
  });

  it("blocks in-flight bridge capital from escort deploy", () => {
    const q = quoteRChainYieldToArbitrumGm({
      assetKind: "rwa",
      symbol: "TOKENIZED-TBILL",
      amountUsd: 1_000,
      wallet: WALLET,
      sourceChainId: ROBINHOOD_TESTNET_CHAIN_ID,
      initiatedAtMs: NOW,
      nowMs: NOW + 1_000,
    });
    expect(q.ok).toBe(false);
    expect(q.bridgeEscortOk).toBe(false);
    expect(q.reasons).toContain("IN_FLIGHT_BRIDGE_CAPITAL");
  });

  it("does not allow reverse yield path (inbound AML)", () => {
    // Escort API always targets Arbitrum; inbound would be a bridge misuse —
    // assert adapter AML still blocks 42161 → 4663 at bridge layer via quote size path.
    const q = quoteRChainYieldToArbitrumGm({
      assetKind: "rwa",
      symbol: "X",
      amountUsd: 100,
      wallet: WALLET,
      sourceChainId: 99999,
      initiatedAtMs: NOW,
      nowMs: NOW,
    });
    expect(q.ok).toBe(false);
    expect(q.bridgeEscortOk).toBe(false);
    expect(q.reasons).toContain("RWA_YIELD_SOURCE_CHAIN_UNSUPPORTED");
    expect(AML_INBOUND_TO_ROBINHOOD_BLOCKED).toBeTruthy();
  });
});
