import { describe, expect, it } from "vitest";
import {
  evaluateIntentGateWithV4Hook,
  evaluateUniswapV4HookGate,
  V4_CODES,
} from "../../src/adapters/uniswap-v4-hook-guard";
import { allocIntentCoreHeap } from "../../src/core/intent-core";
import { FLAG_UNISWAP_SLIPPAGE_EXCEEDED } from "../../src/core/risk-flags";
import {
  evaluateRetailRisk,
  parseTransactionCalldata,
  SELECTOR_UNISWAP_V2_SWAP_EXACT,
  SELECTOR_UNISWAP_V3_EXACT_INPUT_SINGLE,
  SELECTOR_UNISWAP_V4_DONATE,
  SELECTOR_UNISWAP_V4_MODIFY_LIQUIDITY,
  SELECTOR_UNISWAP_V4_SWAP,
  SELECTOR_UNISWAP_V4_UNLOCK,
  type RetailGuardConfig,
} from "../../src/sdk/exomesh-agentic-wallet-guard";

const PM = "0x1111111111111111111111111111111111111111";
const HOOK = "0x2222222222222222222222222222222222222222";
const WALLET = "0x3333333333333333333333333333333333333333";
const ZERO = "0x0000000000000000000000000000000000000000";

function addrWord(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
}

function u256(n: bigint): string {
  const mod = (1n << 256n) + n;
  return (n < 0n ? mod : n).toString(16).padStart(64, "0");
}

/** ABI head: PoolKey (5) + SwapParams (3) + bytes offset. */
function encodeV4Swap(hooks: string, feePips: number, amountSpecified: bigint): string {
  return (
    SELECTOR_UNISWAP_V4_SWAP +
    addrWord("0x0000000000000000000000000000000000000001") +
    addrWord("0x0000000000000000000000000000000000000002") +
    feePips.toString(16).padStart(64, "0") +
    (60).toString(16).padStart(64, "0") +
    addrWord(hooks) +
    "0".repeat(64) +
    u256(amountSpecified) +
    "0".repeat(64) +
    (9 * 32).toString(16).padStart(64, "0") +
    "0".repeat(64)
  );
}

function baseCfg(overrides: Partial<RetailGuardConfig> = {}): RetailGuardConfig {
  return {
    walletAddress: WALLET,
    v4PoolManagers: [PM],
    v4AllowedHooks: [HOOK],
    v4MaxHookFeeBps: 100,
    preferWasm: false,
    ...overrides,
  };
}

describe("uniswap-v4-hook-guard", () => {
  it("LUT maps V4 swap/modify/donate/unlock as swap kind", () => {
    for (const sel of [
      SELECTOR_UNISWAP_V4_SWAP,
      SELECTOR_UNISWAP_V4_MODIFY_LIQUIDITY,
      SELECTOR_UNISWAP_V4_DONATE,
      SELECTOR_UNISWAP_V4_UNLOCK,
    ]) {
      const parsed = parseTransactionCalldata({ to: PM, data: `${sel}${"00".repeat(32)}` });
      expect(parsed?.kind).toBe("swap");
      if (parsed?.kind === "swap") expect(parsed.selectorU32).toBe(Number.parseInt(sel.slice(2), 16));
    }
  });

  it("does not remap V2/V3 selectors", () => {
    const v2 = parseTransactionCalldata({ to: PM, data: `${SELECTOR_UNISWAP_V2_SWAP_EXACT}${"00".repeat(32)}` });
    const v3 = parseTransactionCalldata({ to: PM, data: `${SELECTOR_UNISWAP_V3_EXACT_INPUT_SINGLE}${"00".repeat(32)}` });
    expect(v2?.kind).toBe("swap");
    expect(v3?.kind).toBe("swap");
    if (v2?.kind === "swap") expect(v2.selectorU32).toBe(0x38ed1739);
    if (v3?.kind === "swap") expect(v3.selectorU32).toBe(0x414bf389);
  });

  it("unknown hook FAIL_CLOSED", () => {
    const data = encodeV4Swap("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 3000, 10n ** 18n);
    const r = evaluateUniswapV4HookGate(PM, data, baseCfg());
    expect(r?.code).toBe(V4_CODES.HOOK_NOT_ALLOWLISTED);
  });

  it("allowlisted hook + vanilla fee ALLOW", () => {
    const data = encodeV4Swap(HOOK, 3000, 10n ** 18n);
    expect(evaluateUniswapV4HookGate(PM, data, baseCfg())).toBeNull();
  });

  it("zero hook vanilla pool ALLOW without allowlist entry", () => {
    const data = encodeV4Swap(ZERO, 3000, 10n ** 18n);
    expect(evaluateUniswapV4HookGate(PM, data, baseCfg({ v4AllowedHooks: [] }))).toBeNull();
  });

  it("dynamic/high hook fee FAIL_CLOSED (0x 18% class)", () => {
    const data = encodeV4Swap(HOOK, 180_000, 10n ** 18n);
    const r = evaluateUniswapV4HookGate(PM, data, baseCfg());
    expect(r?.code).toBe(V4_CODES.HOOK_FEE_EXCEEDED);
  });

  it("dynamic fee flag without quoted fee FAIL_CLOSED", () => {
    const data = encodeV4Swap(HOOK, 0x800000, 10n ** 18n);
    const r = evaluateUniswapV4HookGate(PM, data, baseCfg());
    expect(r?.code).toBe(V4_CODES.HOOK_FEE_EXCEEDED);
  });

  it("chaos: spoofed best-quote vs calldata FAIL_CLOSED", () => {
    const specified = 10n ** 18n;
    const data = encodeV4Swap(HOOK, 3000, specified);
    const r = evaluateUniswapV4HookGate(PM, data, baseCfg({ v4QuotedAmountWei: specified * 2n }));
    expect(r?.code).toBe(V4_CODES.QUOTE_SETTLEMENT_MISMATCH);
  });

  it("quoted amount within deviation ALLOW", () => {
    const specified = 10_000n;
    const data = encodeV4Swap(HOOK, 3000, specified);
    expect(evaluateUniswapV4HookGate(PM, data, baseCfg({ v4QuotedAmountWei: 10_040n }))).toBeNull();
  });

  it("opaque unlock FAIL_CLOSED", () => {
    const r = evaluateUniswapV4HookGate(PM, `${SELECTOR_UNISWAP_V4_UNLOCK}${"00".repeat(64)}`, baseCfg());
    expect(r?.code).toBe(V4_CODES.UNKNOWN_SELECTOR);
  });

  it("PoolManager unknown selector FAIL_CLOSED", () => {
    const r = evaluateUniswapV4HookGate(PM, "0xdeadbeef" + "00".repeat(32), baseCfg());
    expect(r?.code).toBe(V4_CODES.UNKNOWN_SELECTOR);
  });

  it("does not reopen RESERVED_ABI_V2 Uniswap V3 bit 4", () => {
    expect(FLAG_UNISWAP_SLIPPAGE_EXCEEDED).toBe(1 << 4);
    const data = encodeV4Swap("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 3000, 1n);
    const r = evaluateUniswapV4HookGate(PM, data, baseCfg());
    expect(r?.code).toBe(V4_CODES.HOOK_NOT_ALLOWLISTED);
  });

  it("wrapper fail-closes before evaluateIntentGatePure", () => {
    const heap = allocIntentCoreHeap();
    const data = encodeV4Swap("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 3000, 1n);
    const out = evaluateIntentGateWithV4Hook(PM, data, baseCfg(), heap, 1n, 1n);
    expect(out.v4Reject?.code).toBe(V4_CODES.HOOK_NOT_ALLOWLISTED);
    expect(out.gate).toBeNull();
  });

  it("evaluateRetailRisk wires V4 hook reject", () => {
    const data = encodeV4Swap("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 3000, 1n);
    const reject = evaluateRetailRisk(baseCfg({ allowedVenueMask: 0 }), "eth_sendTransaction", [
      { to: PM, data },
    ]);
    expect(reject?.code).toBe(V4_CODES.HOOK_NOT_ALLOWLISTED);
  });
});
