import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as auth from "../../../src/adapters/hl/auth";
import {
  placeLimitWithStopLoss,
  sessionKeyFromAgentResult,
  __resetRpcFailoverForTests,
} from "../../../src/adapters/hl/execution";
import { __setSystemStateForTests } from "../../../src/core/state";
import {
  jsonResponse,
  PASSING_PRE_TRADE,
  TEST_AGENT_ADDRESS,
  testWallet,
} from "./execution-fixtures";

describe("hl/execution — place limit & session key mapping", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    __setSystemStateForTests(null);
    __resetRpcFailoverForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __setSystemStateForTests(null);
    __resetRpcFailoverForTests();
  });

  it("placeLimitWithStopLoss sends atomic entry + SL grouping", async () => {
    vi.spyOn(auth, "signHyperliquidAction").mockResolvedValue(
      "0x" + "55".repeat(65),
    );
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const result = await placeLimitWithStopLoss(
      {
        asset: 0,
        isBuy: true,
        size: 0.01,
        limitPx: 50000,
        stopTriggerPx: 48000,
        preTrade: PASSING_PRE_TRADE,
      },
      { signer: testWallet },
    );

    const action = result.request.action as {
      type: string;
      orders: unknown[];
      grouping: string;
    };
    expect(action.type).toBe("order");
    expect(action.orders).toHaveLength(2);
    expect(action.grouping).toBe("normalTpsl");
  });

  it("sessionKeyFromAgentResult maps auth result to execution context", () => {
    const ctx = sessionKeyFromAgentResult({
      action: {
        type: "approveAgent",
        signatureChainId: "0x66eee",
        hyperliquidChain: "Mainnet",
        agentAddress: TEST_AGENT_ADDRESS,
        agentName: "BeDeltaAgent",
        nonce: 1,
      },
      signature: "0x",
      agentAddress: TEST_AGENT_ADDRESS,
      expiresAt: 999,
      nonce: 1,
      hyperliquidChain: "Mainnet",
    }, testWallet.address);

    expect(ctx.agentAddress).toBe(TEST_AGENT_ADDRESS.toLowerCase());
    expect(ctx.expiresAt).toBe(999);
    expect(ctx.masterWalletAddress).toBe(testWallet.address.toLowerCase());
    expect(ctx.vaultAddress).toBeUndefined();
  });
});
