import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetRetailGuardStateForTests,
  ERC7540_CODES,
  encodeErc7540RequestDepositCalldata,
  encodeErc7540SetOperatorCalldata,
  evaluateErc7540AsyncEscortGuard,
  evaluateRetailRisk,
  parseTransactionCalldata,
  withRetailGuardProvider,
  type EIP1193Provider,
  type RetailGuardConfig,
} from "../src/sdk/exomesh-agentic-wallet-guard";

const WALLET = "0x1111111111111111111111111111111111111111";
const VAULT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TRUSTED_OPERATOR = "0xdddddddddddddddddddddddddddddddddddddddd";
const MALICIOUS = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function baseConfig(overrides: Partial<RetailGuardConfig> = {}): RetailGuardConfig {
  return {
    walletAddress: WALLET,
    allowedOperators: [TRUSTED_OPERATOR.toLowerCase()],
    allowedVenues: [VAULT.toLowerCase()],
    erc7540MaxSlippageBps: 50,
    ...overrides,
  };
}

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

describe("erc7540-async-escort", () => {
  beforeEach(() => __resetRetailGuardStateForTests());

  it("PASS — valid requestDeposit with whitelisted controller", () => {
    const parsed = parseTransactionCalldata({
      to: VAULT,
      data: encodeErc7540RequestDepositCalldata(1_000_000n, TRUSTED_OPERATOR, WALLET),
    });
    expect(parsed?.kind).toBe("erc7540_request_deposit");
    const reject = evaluateErc7540AsyncEscortGuard(
      parsed as NonNullable<typeof parsed>,
      baseConfig({
        erc7540AsyncQuote: {
          requestAmountWei: 1_000_000n,
          claimableAmountWei: 999_800n,
          maxSlippageBps: 50,
        },
      }),
    );
    expect(reject).toBeNull();
  });

  it("REJECT — malicious setOperator attempt", () => {
    const parsed = parseTransactionCalldata({
      to: VAULT,
      data: encodeErc7540SetOperatorCalldata(MALICIOUS, true),
    });
    expect(parsed?.kind).toBe("erc7540_set_operator");
    const reject = evaluateErc7540AsyncEscortGuard(
      parsed as NonNullable<typeof parsed>,
      baseConfig(),
    );
    expect(reject?.code).toBe(ERC7540_CODES.OPERATOR_REJECTED);
  });

  it("REJECT — high slippage async vault requestDeposit", async () => {
    const base = mockProvider();
    const guarded = withRetailGuardProvider(
      base,
      baseConfig({
        erc7540AsyncQuote: {
          requestAmountWei: 1_000_000n,
          claimableAmountWei: 800_000n,
          maxSlippageBps: 50,
        },
      }),
    );
    await expect(
      guarded.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: WALLET,
            to: VAULT,
            data: encodeErc7540RequestDepositCalldata(1_000_000n, TRUSTED_OPERATOR, WALLET),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: ERC7540_CODES.ASYNC_SLIPPAGE_DRIFT });
    expect(base.calls).toHaveLength(0);

    const direct = evaluateRetailRisk(
      baseConfig({
        erc7540AsyncQuote: {
          requestAmountWei: 1_000_000n,
          claimableAmountWei: 800_000n,
          maxSlippageBps: 50,
        },
      }),
      "eth_sendTransaction",
      [
        {
          to: VAULT,
          data: encodeErc7540RequestDepositCalldata(1_000_000n, TRUSTED_OPERATOR, WALLET),
        },
      ],
    );
    expect(direct?.code).toBe(ERC7540_CODES.ASYNC_SLIPPAGE_DRIFT);
  });
});
