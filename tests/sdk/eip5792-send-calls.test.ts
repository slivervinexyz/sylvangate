import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetRetailGuardStateForTests,
  EIP5792_WALLET_SEND_CALLS,
  encodeApproveCalldata,
  parseWalletSendCalls,
  RetailGuardRejectedError,
  UINT256_MAX,
  withRetailGuardProvider,
  type EIP1193Provider,
  type RetailGuardConfig,
} from "../../src/sdk/exomesh-agentic-wallet-guard";

const WALLET = "0x1111111111111111111111111111111111111111";
const GMX_ROUTER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USDC = "0xaf88d065e77c1c973b2696121c3f3f3f3f3f3f3f";
const MALICIOUS = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TRUSTED_SPENDER = "0xdddddddddddddddddddddddddddddddddddddddd";

function mockProvider(): EIP1193Provider & { calls: Array<{ method: string; params?: unknown[] }> } {
  const calls: Array<{ method: string; params?: unknown[] }> = [];
  return {
    calls,
    request: async (args) => {
      calls.push(args);
      return "0xok";
    },
  };
}

function baseConfig(): RetailGuardConfig {
  return {
    walletAddress: WALLET,
    allowedVenueMask: 0b1,
    allowedVenues: [GMX_ROUTER.toLowerCase(), USDC.toLowerCase()],
    allowedSpenders: [TRUSTED_SPENDER.toLowerCase()],
    contractVenueIndex: {
      [GMX_ROUTER.toLowerCase()]: 0,
      [USDC.toLowerCase()]: 1,
    },
    maxApprovalUsd: 10_000,
    approvalTokenPriceUsd: 1,
    approvalTokenDecimals: 18,
  };
}

function sendCalls(calls: unknown[]) {
  return {
    method: EIP5792_WALLET_SEND_CALLS,
    params: [{ version: "2.0.0", from: WALLET, chainId: "0xa4b1", atomicRequired: true, calls }],
  };
}

describe("EIP-5792 wallet_sendCalls", () => {
  beforeEach(() => __resetRetailGuardStateForTests());

  it("parses calls[] and passes a healthy two-call batch (single attempt)", async () => {
    const parsed = parseWalletSendCalls(sendCalls([{ to: GMX_ROUTER }, { to: GMX_ROUTER }]).params);
    expect(parsed).toHaveLength(2);
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    const hash = await guarded.request(sendCalls([{ to: GMX_ROUTER }, { to: GMX_ROUTER }]));
    expect(hash).toBe("0xok");
    expect(base.calls).toHaveLength(1);
    expect(base.calls[0]?.method).toBe(EIP5792_WALLET_SEND_CALLS);
  });

  it("fail-closed on one toxic approve inside the batch (0-gas, no forward)", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    await expect(
      guarded.request(
        sendCalls([
          { to: GMX_ROUTER, data: "0x" },
          { to: USDC, data: encodeApproveCalldata(MALICIOUS, UINT256_MAX) },
        ]),
      ),
    ).rejects.toMatchObject({
      name: "RetailGuardRejectedError",
      code: "UNAUTHORIZED_SPENDER_REJECTED",
    });
    expect(base.calls).toHaveLength(0);
    expect(RetailGuardRejectedError).toBeDefined();
  });

  it("rejects empty or malformed calls[]", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    await expect(guarded.request(sendCalls([]))).rejects.toMatchObject({
      code: "SEND_CALLS_BATCH_REJECTED",
    });
    await expect(
      guarded.request({ method: EIP5792_WALLET_SEND_CALLS, params: [{}] }),
    ).rejects.toMatchObject({ code: "SEND_CALLS_BATCH_REJECTED" });
    expect(base.calls).toHaveLength(0);
  });
});
