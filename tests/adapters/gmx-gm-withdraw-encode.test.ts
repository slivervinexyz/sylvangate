import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, type Hex } from "viem";
import { assertGmxGmWithdrawWire, auditGmxGmWithdrawWireParams } from "../../src/services/adapters/gmx-gm-withdraw-audit";
import {
  buildGmxGmWithdrawFromLegacyInput,
  buildGmxGmWithdrawGmAmountPayload,
  buildGmxGmWithdrawUnsignedPayload,
} from "../../src/services/adapters/gmx-gm-withdraw-build";
import {
  GMX_GM_ETH_USDC_MARKET,
  GMX_GM_WITHDRAW_MULTICALL_METHODS,
  GMX_GM_WITHDRAW_TOKEN_SPENDERS,
  GMX_WITHDRAWAL_VAULT_ARBITRUM,
} from "../../src/services/adapters/gmx-gm-withdraw-constants";
import {
  buildGmxCreateWithdrawalWireParams,
  encodeGmxCreateWithdrawalCalldata,
  GMX_CREATE_WITHDRAWAL_ABI_FRAGMENT,
  gmxCreateWithdrawalAbi,
  stripGmxGmWithdrawOnChainMetadata,
} from "../../src/services/adapters/gmx-gm-withdraw-encode";
import {
  assertGmxGmWithdrawMulticallLegs,
  buildGmxGmWithdrawMulticallCalls,
  buildGmxGmWithdrawRouterMulticall,
  decodeGmxGmWithdrawMulticallLegs,
} from "../../src/services/adapters/gmx-gm-withdraw-multicall";
import { buildGmxV2UnsignedWithdrawPayload } from "../../src/services/adapters/gmx-v2-order-payload-withdraw-builders";

const USER = getAddress("0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F");
const MARKET = GMX_GM_ETH_USDC_MARKET;
const EXEC_FEE = 10n ** 15n;
const GM_HALF = 500_000_000_000_000_000n;

function encodeGmxReferenceCreateWithdrawal(payload: ReturnType<typeof buildGmxGmWithdrawGmAmountPayload>): Hex {
  const wire = buildGmxCreateWithdrawalWireParams(payload, MARKET);
  const sdkAbi = parseAbi([GMX_CREATE_WITHDRAWAL_ABI_FRAGMENT]);
  return encodeFunctionData({ abi: sdkAbi, functionName: "createWithdrawal", args: [wire] });
}

describe("gmx-gm-withdraw-encode", () => {
  it("GMX_GM_WITHDRAW_TOKEN_SPENDERS targets GMX v2 Router for sendTokens", () => {
    expect(GMX_GM_WITHDRAW_TOKEN_SPENDERS).toContain("0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6");
    expect(GMX_GM_WITHDRAW_TOKEN_SPENDERS).toHaveLength(1);
  });

  it("buildGmxCreateWithdrawalWireParams aligns ETH/USDC GM market", () => {
    const payload = buildGmxGmWithdrawGmAmountPayload({
      receiver: USER,
      gmTokenAmount: GM_HALF,
      sizeUsd: 100,
      executionFeeWei: EXEC_FEE.toString(),
      skipFailClosedGuards: true,
    });
    const wire = buildGmxCreateWithdrawalWireParams(payload, MARKET);
    expect(wire.addresses.market).toBe(MARKET);
    expect(wire.addresses.receiver).toBe(USER);
    expect(wire.executionFee).toBe(EXEC_FEE);
    expect(wire.dataList).toEqual([]);
    const audit = auditGmxGmWithdrawWireParams(wire, MARKET);
    expect(audit.ok).toBe(true);
    assertGmxGmWithdrawWire(wire, MARKET);
  });

  it("encodeGmxCreateWithdrawalCalldata round-trips ABI decode", () => {
    const payload = stripGmxGmWithdrawOnChainMetadata(
      buildGmxGmWithdrawGmAmountPayload({
        receiver: USER,
        gmTokenAmount: GM_HALF,
        sizeUsd: 100,
        executionFeeWei: EXEC_FEE.toString(),
        skipFailClosedGuards: true,
      }),
    );
    const calldata = encodeGmxCreateWithdrawalCalldata(payload, MARKET);
    const decoded = decodeFunctionData({ abi: gmxCreateWithdrawalAbi, data: calldata });
    expect(decoded.functionName).toBe("createWithdrawal");
    expect(decoded.args[0].addresses.market).toBe(MARKET);
    expect(decoded.args[0].dataList).toEqual([]);
  });

  it("matches reference SDK encodeFunctionData serialization", () => {
    const payload = stripGmxGmWithdrawOnChainMetadata(
      buildGmxGmWithdrawGmAmountPayload({
        receiver: USER,
        gmTokenAmount: GM_HALF,
        sizeUsd: 100,
        executionFeeWei: EXEC_FEE.toString(),
        skipFailClosedGuards: true,
      }),
    );
    expect(encodeGmxCreateWithdrawalCalldata(payload, MARKET)).toBe(encodeGmxReferenceCreateWithdrawal(payload));
  });

  it("3-leg multicall: sendWnt → sendTokens(GM) → createWithdrawal", () => {
    const payload = buildGmxGmWithdrawGmAmountPayload({
      receiver: USER,
      gmTokenAmount: GM_HALF,
      sizeUsd: 100,
      executionFeeWei: EXEC_FEE.toString(),
      skipFailClosedGuards: true,
    });
    const { calls, data, value, executionFee, marketTokenAmount } = buildGmxGmWithdrawRouterMulticall(payload, MARKET);
    expect(calls).toHaveLength(GMX_GM_WITHDRAW_MULTICALL_METHODS.length);
    expect(GMX_GM_WITHDRAW_MULTICALL_METHODS).toEqual(["sendWnt", "sendTokens", "createWithdrawal"]);
    expect(value).toBe(executionFee);
    expect(marketTokenAmount).toBe(GM_HALF);
    expect(data.startsWith("0xac9650d8")).toBe(true);
    const legs = decodeGmxGmWithdrawMulticallLegs(calls);
    expect(legs.sendWnt.receiver).toBe(GMX_WITHDRAWAL_VAULT_ARBITRUM);
    expect(legs.sendWnt.amount).toBe(EXEC_FEE);
    expect(legs.sendTokens.token).toBe(MARKET);
    expect(legs.sendTokens.destination).toBe(GMX_WITHDRAWAL_VAULT_ARBITRUM);
    expect(legs.sendTokens.amount).toBe(GM_HALF);
    expect(legs.createWithdrawal).toBe(encodeGmxReferenceCreateWithdrawal(payload));
    assertGmxGmWithdrawMulticallLegs({
      calls,
      withdrawalVault: GMX_WITHDRAWAL_VAULT_ARBITRUM,
      executionFee: EXEC_FEE,
      marketTokenAmount: GM_HALF,
      marketToken: MARKET,
    });
  });

  it("buildGmxGmWithdrawMulticallCalls rejects zero GM amount", () => {
    const payload = buildGmxGmWithdrawGmAmountPayload({
      receiver: USER,
      gmTokenAmount: GM_HALF,
      sizeUsd: 100,
      skipFailClosedGuards: true,
    });
    expect(() =>
      buildGmxGmWithdrawMulticallCalls({
        payload: { ...payload, marketTokenAmount: "0" },
        market: MARKET,
      }),
    ).toThrow(/marketTokenAmount must be > 0/);
  });

  it("buildGmxGmWithdrawFromLegacyInput maps gmTokenAmount", () => {
    const payload = buildGmxGmWithdrawFromLegacyInput({
      marketToken: MARKET,
      sizeUsd: 100,
      gmTokenAmount: GM_HALF.toString(),
      receiver: USER,
      skipFailClosedGuards: true,
    });
    expect(payload.marketTokenAmount).toBe(GM_HALF.toString());
    expect(payload.addresses.market).toBe(MARKET);
  });

  it("buildGmxV2UnsignedWithdrawPayload thin wrapper preserves legacy Record shape", () => {
    const legacy = buildGmxV2UnsignedWithdrawPayload({
      marketToken: MARKET,
      sizeUsd: 100,
      gmTokenAmount: GM_HALF.toString(),
      skipFailClosedGuards: true,
    });
    expect(legacy.action).toBe("withdraw");
    expect(legacy.numbers).toMatchObject({
      marketTokenAmount: GM_HALF.toString(),
      callbackGasLimit: "0",
    });
    expect(legacy.addresses).toMatchObject({ market: MARKET });
    expect(legacy.gmTokenAmountUsd).toBe("100.00");
  });

  it("buildGmxGmWithdrawUnsignedPayload rejects zero GM amount", () => {
    expect(() =>
      buildGmxGmWithdrawUnsignedPayload({
        marketToken: MARKET,
        receiver: USER,
        marketTokenAmount: 0n,
        sizeUsd: 100,
        skipFailClosedGuards: true,
      }),
    ).toThrow(/marketTokenAmount must be > 0/);
  });
});
