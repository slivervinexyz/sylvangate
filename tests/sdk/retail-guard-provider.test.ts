import { describe, expect, it, beforeEach } from "vitest";
import { INTENT_RING_U32 } from "../../src/core/intent-core-buffers";
import {
  __resetRetailGuardStateForTests,
  announceGuardedProvider,
  encodeApproveCalldata,
  encodePermit2ApproveCalldata,
  encodePermit2PermitCalldata,
  evaluateRpcTransportProtocol,
  evaluateTransportStreamSync,
  evaluateRetailApproveGate,
  evaluateRetailRisk,
  evaluateRetailVenueAllowlist,
  formatRetailWarning,
  isRpcTransportSyncFailed,
  isRetailGuardChannelSevered,
  RPC_TRANSPORT_SYNC_FAIL_THRESHOLD,
  parseTransactionCalldata,
  RetailGuardRejectedError,
  SELECTOR_GMX_MULTICALL,
  SELECTOR_PERMIT2_APPROVE,
  SELECTOR_PERMIT2_PERMIT,
  SELECTOR_UNISWAP_V2_SWAP_EXACT,
  SELECTOR_UNISWAP_V3_EXACT_INPUT_SINGLE,
  UINT160_MAX,
  UINT256_MAX,
  verifyTransportBitmark,
  TS_RING_BASE,
  withRetailGuardProvider,
  type EIP1193Provider,
  type EIP6963EventTarget,
  type RetailGuardConfig,
} from "../../src/sdk/exomesh-agentic-wallet-guard";

const WALLET = "0x1111111111111111111111111111111111111111";
const GMX_ROUTER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const UNISWAP_ROUTER = "0xcccccccccccccccccccccccccccccccccccccccc";
const USDC = "0xaf88d065e77c1c973b2696121c3f3f3f3f3f3f3f";
const MALICIOUS = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TRUSTED_SPENDER = "0xdddddddddddddddddddddddddddddddddddddddd";
const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78b6";

function mockProvider(
  handler: (args: { method: string; params?: unknown[] }) => unknown = () => "0xok",
): EIP1193Provider & { calls: Array<{ method: string; params?: unknown[] }> } {
  const calls: Array<{ method: string; params?: unknown[] }> = [];
  return {
    calls,
    request: async (args) => {
      calls.push(args);
      return handler(args);
    },
  };
}

function baseConfig(overrides: Partial<RetailGuardConfig> = {}): RetailGuardConfig {
  return {
    walletAddress: WALLET,
    allowedVenueMask: 0b111,
    allowedVenues: [
      GMX_ROUTER.toLowerCase(),
      UNISWAP_ROUTER.toLowerCase(),
      USDC.toLowerCase(),
      PERMIT2.toLowerCase(),
    ],
    allowedSpenders: [TRUSTED_SPENDER.toLowerCase()],
    contractVenueIndex: {
      [GMX_ROUTER.toLowerCase()]: 0,
      [UNISWAP_ROUTER.toLowerCase()]: 1,
      [USDC.toLowerCase()]: 2,
      [PERMIT2.toLowerCase()]: 3,
    },
    maxApprovalUsd: 10_000,
    approvalTokenPriceUsd: 1,
    approvalTokenDecimals: 18,
    soilQuote: {
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3498.25,
      depthUsd: 500_000,
      maxSlippage: 0.005,
      minDepthUsd: 100_000,
    },
    ...overrides,
  };
}

/** Generic DEX router selectors — EIP-1193 calldata parsing only (not pruned Uniswap V3 adapter). */
describe("calldata-parser", () => {
  it("parses infinite ERC20 approve", () => {
    const parsed = parseTransactionCalldata({
      to: USDC,
      data: encodeApproveCalldata(MALICIOUS, UINT256_MAX),
    });
    expect(parsed?.kind).toBe("approve");
    if (parsed?.kind === "approve") {
      expect(parsed.infinite).toBe(true);
      expect(parsed.spender).toBe(MALICIOUS.toLowerCase());
    }
  });

  it("parses finite ERC20 approve", () => {
    const parsed = parseTransactionCalldata({
      to: USDC,
      data: encodeApproveCalldata(TRUSTED_SPENDER, 1_000_000n),
    });
    expect(parsed?.kind).toBe("approve");
    if (parsed?.kind === "approve") expect(parsed.infinite).toBe(false);
  });

  it("parses ERC20 transfer", () => {
    const hex =
      "0xa9059cbb" +
      MALICIOUS.slice(2).padStart(64, "0") +
      (1n).toString(16).padStart(64, "0");
    const parsed = parseTransactionCalldata({ to: USDC, data: hex });
    expect(parsed?.kind).toBe("transfer");
  });

  it("parses Uniswap V2 swap selector", () => {
    const parsed = parseTransactionCalldata({
      to: UNISWAP_ROUTER,
      data: SELECTOR_UNISWAP_V2_SWAP_EXACT + "0".repeat(128),
    });
    expect(parsed?.kind).toBe("swap");
  });

  it("parses Uniswap V3 exactInputSingle selector", () => {
    const parsed = parseTransactionCalldata({
      to: UNISWAP_ROUTER,
      data: SELECTOR_UNISWAP_V3_EXACT_INPUT_SINGLE + "0".repeat(128),
    });
    expect(parsed?.kind).toBe("swap");
  });

  it("parses GMX multicall selector", () => {
    const parsed = parseTransactionCalldata({
      to: GMX_ROUTER,
      data: SELECTOR_GMX_MULTICALL + "0".repeat(128),
    });
    expect(parsed?.kind).toBe("swap");
  });

  it("parses Permit2 approve selector (uint160)", () => {
    const parsed = parseTransactionCalldata({
      to: PERMIT2,
      data: encodePermit2ApproveCalldata(USDC, MALICIOUS, UINT160_MAX),
    });
    expect(parsed?.kind).toBe("permit2_approve");
    if (parsed?.kind === "permit2_approve") {
      expect(parsed.infinite).toBe(true);
      expect(parsed.spender).toBe(MALICIOUS.toLowerCase());
      expect(parsed.token).toBe(USDC.toLowerCase());
    }
  });

  it("parses Permit2 permit selector (EIP-7730 surface)", () => {
    const parsed = parseTransactionCalldata({
      to: PERMIT2,
      data: encodePermit2PermitCalldata(WALLET, USDC, MALICIOUS, UINT160_MAX),
    });
    expect(parsed?.kind).toBe("permit2_permit");
    if (parsed?.kind === "permit2_permit") {
      expect(parsed.infinite).toBe(true);
      expect(parsed.spender).toBe(MALICIOUS.toLowerCase());
      expect(parsed.owner).toBe(WALLET.toLowerCase());
    }
    expect(SELECTOR_PERMIT2_PERMIT).toBe("0x2a0886f7");
    expect(SELECTOR_PERMIT2_APPROVE).toBe("0x87517c45");
  });
});

describe("guard-engine — retail policy rules", () => {
  beforeEach(() => __resetRetailGuardStateForTests());

  it("rejects infinite approve for untrusted spender", () => {
    const reject = evaluateRetailApproveGate(
      {
        kind: "approve",
        token: USDC,
        spender: MALICIOUS.toLowerCase(),
        amountWei: UINT256_MAX,
        infinite: true,
      },
      baseConfig(),
    );
    expect(reject?.code).toBe("UNAUTHORIZED_SPENDER_REJECTED");
    expect(reject?.plainTextWarning).toContain("INFINITE");
  });

  it("allows infinite approve for trusted spender", () => {
    const reject = evaluateRetailApproveGate(
      {
        kind: "approve",
        token: USDC,
        spender: TRUSTED_SPENDER.toLowerCase(),
        amountWei: UINT256_MAX,
        infinite: true,
      },
      baseConfig(),
    );
    expect(reject).toBeNull();
  });

  it("rejects finite approve exceeding maxApprovalUsd", () => {
    const reject = evaluateRetailApproveGate(
      {
        kind: "approve",
        token: USDC,
        spender: MALICIOUS.toLowerCase(),
        amountWei: BigInt(20_000) * 10n ** 18n,
        infinite: false,
      },
      baseConfig({ maxApprovalUsd: 10_000 }),
    );
    expect(reject?.code).toBe("UNAUTHORIZED_SPENDER_REJECTED");
  });

  it("rejects contract outside allowedVenues", () => {
    const reject = evaluateRetailVenueAllowlist(MALICIOUS, baseConfig());
    expect(reject?.code).toBe("VENUE_DRIFT_REJECTED");
  });

  it("passes contract inside allowedVenues", () => {
    expect(evaluateRetailVenueAllowlist(GMX_ROUTER, baseConfig())).toBeNull();
  });

  it("formatRetailWarning emits ALERT prefix", () => {
    const msg = formatRetailWarning("SLIPPAGE_EXCEEDED", { crossSlippage: "0.08" });
    expect(msg.startsWith("ALERT:")).toBe(true);
    expect(msg).toContain("0.08");
  });
});

describe("evaluateRetailRisk — direct evaluator", () => {
  beforeEach(() => __resetRetailGuardStateForTests());

  it("trips honeypot slippage on swap path", () => {
    const reject = evaluateRetailRisk(
      baseConfig({
        soilQuote: {
          hlSpot: 3500,
          hlPerp: 3500,
          dydxPerp: 3000,
          depthUsd: 500_000,
          maxSlippage: 0.005,
          minDepthUsd: 100_000,
        },
      }),
      "eth_sendTransaction",
      [{ from: WALLET, to: UNISWAP_ROUTER, data: SELECTOR_UNISWAP_V2_SWAP_EXACT + "00" }],
    );
    expect(reject?.code).toBe("SLIPPAGE_EXCEEDED");
  });

  it("trips shallow depth honeypot fuse", () => {
    const reject = evaluateRetailRisk(
      baseConfig({
        soilQuote: {
          hlSpot: 3500,
          hlPerp: 3500,
          dydxPerp: 3498,
          depthUsd: 50_000,
          maxSlippage: 0.005,
          minDepthUsd: 100_000,
        },
      }),
      "eth_sendTransaction",
      [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }],
    );
    expect(reject?.code).toBe("DEPTH_INSUFFICIENT");
  });
});

describe("announceGuardedProvider — EIP-6963", () => {
  it("announces guarded provider on requestProvider", () => {
    const announced: unknown[] = [];
    const target: EIP6963EventTarget = {
      dispatchEvent: (event) => {
        announced.push(event.detail);
        return true;
      },
      addEventListener: () => {},
    };
    const base = mockProvider();
    announceGuardedProvider(base, baseConfig(), {
      uuid: "test-uuid",
      target,
      rdns: "io.slivervine.agenticretailwalletguard",
    });
    expect(announced).toHaveLength(1);
    expect(announced[0]).toMatchObject({
      info: { uuid: "test-uuid", rdns: "io.slivervine.agenticretailwalletguard" },
    });
  });

  it("falls back to guarded wrap when EIP-6963 target unavailable", async () => {
    const base = mockProvider(() => "0xok");
    const guarded = announceGuardedProvider(base, baseConfig(), {
      announce: false,
      target: {},
    });
    const hash = await guarded.request({
      method: "eth_sendTransaction",
      params: [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }],
    });
    expect(hash).toBe("0xok");
  });
});

describe("withRetailGuardProvider — EIP-1193 integration", () => {
  beforeEach(() => __resetRetailGuardStateForTests());

  it("passes healthy GMX eth_sendTransaction", async () => {
    const base = mockProvider(() => "0xdeadbeef");
    const guarded = withRetailGuardProvider(base, baseConfig());
    const hash = await guarded.request({
      method: "eth_sendTransaction",
      params: [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }],
    });
    expect(hash).toBe("0xdeadbeef");
    expect(base.calls).toHaveLength(1);
  });

  it("passes healthy Uniswap swap when soil is clean", async () => {
    const base = mockProvider(() => "0xswap");
    const guarded = withRetailGuardProvider(base, baseConfig());
    await guarded.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: WALLET,
          to: UNISWAP_ROUTER,
          data: SELECTOR_UNISWAP_V2_SWAP_EXACT + "0".repeat(128),
        },
      ],
    });
    expect(base.calls).toHaveLength(1);
  });

  it("blocks Permit2 infinite approve for untrusted spender", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    await expect(
      guarded.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: WALLET,
            to: PERMIT2,
            data: encodePermit2ApproveCalldata(USDC, MALICIOUS, UINT160_MAX),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_SPENDER_REJECTED" });
    expect(base.calls).toHaveLength(0);
  });

  it("blocks infinite ERC20 approve for untrusted spender", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    await expect(
      guarded.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: WALLET,
            to: USDC,
            data: encodeApproveCalldata(MALICIOUS, UINT256_MAX),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_SPENDER_REJECTED" });
    expect(base.calls).toHaveLength(0);
  });

  it("allows infinite approve for trusted spender on allowlisted token", async () => {
    const base = mockProvider(() => "0xapprove");
    const guarded = withRetailGuardProvider(base, baseConfig());
    await guarded.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: WALLET,
          to: USDC,
          data: encodeApproveCalldata(TRUSTED_SPENDER, UINT256_MAX),
        },
      ],
    });
    expect(base.calls).toHaveLength(1);
  });

  it("blocks EIP-712 Permit phishing verifyingContract mismatch", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    const typedData = JSON.stringify({
      domain: {
        name: "Permit",
        version: "1",
        chainId: 42161,
        verifyingContract: MALICIOUS,
      },
      types: { Permit: [{ name: "spender", type: "address" }] },
      primaryType: "Permit",
      message: { spender: TRUSTED_SPENDER },
    });
    await expect(
      guarded.request({ method: "eth_signTypedData_v4", params: [WALLET, typedData] }),
    ).rejects.toMatchObject({ code: "VENUE_DRIFT_REJECTED" });
  });

  it("blocks EIP-712 Permit with untrusted message.spender", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    const typedData = JSON.stringify({
      domain: {
        name: "Permit",
        version: "1",
        chainId: 42161,
        verifyingContract: USDC,
      },
      types: { Permit: [{ name: "spender", type: "address" }] },
      primaryType: "Permit",
      message: { spender: MALICIOUS },
    });
    await expect(
      guarded.request({ method: "eth_signTypedData_v4", params: [WALLET, typedData] }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_SPENDER_REJECTED" });
  });

  it("passes EIP-712 Permit on allowlisted token + spender", async () => {
    const base = mockProvider(() => "0xsig");
    const guarded = withRetailGuardProvider(base, baseConfig());
    const typedData = JSON.stringify({
      domain: {
        name: "Permit",
        version: "1",
        chainId: 42161,
        verifyingContract: USDC,
      },
      types: { Permit: [{ name: "spender", type: "address" }] },
      primaryType: "Permit",
      message: { spender: TRUSTED_SPENDER },
    });
    await guarded.request({ method: "eth_signTypedData_v4", params: [WALLET, typedData] });
    expect(base.calls).toHaveLength(1);
  });

  it("blocks high slippage honeypot trade (0-Gas)", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(
      base,
      baseConfig({
        soilQuote: {
          hlSpot: 3500,
          hlPerp: 3500,
          dydxPerp: 3200,
          depthUsd: 500_000,
          maxSlippage: 0.005,
          minDepthUsd: 100_000,
        },
      }),
    );
    const err = await guarded
      .request({
        method: "eth_sendTransaction",
        params: [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }],
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(RetailGuardRejectedError);
    expect((err as RetailGuardRejectedError).code).toBe("SLIPPAGE_EXCEEDED");
    expect((err as RetailGuardRejectedError).plainTextWarning).toContain("ALERT:");
  });

  it("severs channel on 4th rapid submit", async () => {
    const base = mockProvider(() => "0x1");
    const guarded = withRetailGuardProvider(base, baseConfig({ maxAttempts: 3 }));
    const params = [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }];
    await guarded.request({ method: "eth_sendTransaction", params });
    await guarded.request({ method: "eth_sendTransaction", params });
    await guarded.request({ method: "eth_sendTransaction", params });
    await expect(
      guarded.request({ method: "eth_sendTransaction", params }),
    ).rejects.toMatchObject({ code: "MAX_ATTEMPTS_EXCEEDED_SEVERED" });
    expect(isRetailGuardChannelSevered()).toBe(true);
  });

  it("blocks subsequent calls after channel severed", async () => {
    const base = mockProvider(() => "0x1");
    const guarded = withRetailGuardProvider(base, baseConfig({ maxAttempts: 1 }));
    const params = [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }];
    await guarded.request({ method: "eth_sendTransaction", params });
    await expect(
      guarded.request({ method: "eth_sendTransaction", params }),
    ).rejects.toMatchObject({ code: "MAX_ATTEMPTS_EXCEEDED_SEVERED" });
    await expect(
      guarded.request({ method: "eth_sendTransaction", params }),
    ).rejects.toMatchObject({ code: "CHANNEL_SEVERED" });
  });

  it("passes through non-guarded eth_chainId unchanged", async () => {
    const base = mockProvider(() => "0x66eee");
    const guarded = withRetailGuardProvider(base, baseConfig());
    const chainId = await guarded.request({ method: "eth_chainId" });
    expect(chainId).toBe("0x66eee");
  });

  it("rejects tx to contract outside allowedVenues even without calldata", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(base, baseConfig());
    await expect(
      guarded.request({
        method: "eth_sendTransaction",
        params: [{ from: WALLET, to: MALICIOUS, value: "0x0" }],
      }),
    ).rejects.toMatchObject({ code: "VENUE_DRIFT_REJECTED" });
  });
});

describe("transport-stream — RPC protocol bitmark", () => {
  beforeEach(() => __resetRetailGuardStateForTests());

  it("initializes and verifies transport bitmark", () => {
    expect(verifyTransportBitmark()).toBe(true);
    expect(verifyTransportBitmark()).toBe(true);
  });

  it("reports healthy sync for legitimate SDK callers", () => {
    const sync = evaluateTransportStreamSync(true);
    expect(sync.ok).toBe(true);
    expect(sync.bitmarkValid).toBe(true);
    expect(sync.syncLagScore).toBe(0);
  });

  it("accumulates sync lag under tampered bitmark and fail-closes at threshold", () => {
    verifyTransportBitmark();
    INTENT_RING_U32[TS_RING_BASE] = 0xdeadbeef;

    for (let i = 0; i < RPC_TRANSPORT_SYNC_FAIL_THRESHOLD - 1; i += 1) {
      const sync = evaluateTransportStreamSync(true);
      expect(sync.ok).toBe(true);
    }

    const tripped = evaluateTransportStreamSync(true);
    expect(tripped.ok).toBe(false);
    expect(isRpcTransportSyncFailed()).toBe(true);

    const reject = evaluateRpcTransportProtocol(baseConfig());
    expect(reject?.code).toBe("RPC_TRANSPORT_SYNC_FAILED");
    expect(formatRetailWarning("RPC_TRANSPORT_SYNC_FAILED")).toContain("nonce drift");
  });

  it("blocks guarded provider after RPC transport sync failure under load", async () => {
    verifyTransportBitmark();
    INTENT_RING_U32[TS_RING_BASE] = 0xcafebabe;

    const base = mockProvider(() => "0x1");
    const guarded = withRetailGuardProvider(base, baseConfig());
    const params = [{ from: WALLET, to: GMX_ROUTER, value: "0x0" }];

    for (let i = 0; i < RPC_TRANSPORT_SYNC_FAIL_THRESHOLD - 1; i += 1) {
      await guarded.request({ method: "eth_sendTransaction", params });
    }

    await expect(
      guarded.request({ method: "eth_sendTransaction", params }),
    ).rejects.toMatchObject({ code: "RPC_TRANSPORT_SYNC_FAILED" });
  });
});
