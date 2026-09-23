import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, type Hex } from "viem";
import { assertGmxGmDepositWire, auditGmxGmDepositWireParams } from "../../src/services/adapters/gmx-gm-deposit-audit";
import {
  buildGmxGmDepositFromLegacyInput,
  buildGmxGmDepositUnsignedPayload,
  buildGmxGmDualTokenDepositPayload,
  buildGmxGmUsdcOnlyDepositPayload,
} from "../../src/services/adapters/gmx-gm-deposit-build";
import {
  GMX_DEPOSIT_VAULT_ARBITRUM,
  GMX_GM_ETH_USDC_LONG_TOKEN,
  GMX_GM_ETH_USDC_MARKET,
  GMX_GM_ETH_USDC_SHORT_TOKEN,
} from "../../src/services/adapters/gmx-gm-deposit-constants";
import {
  buildGmxCreateDepositWireParams,
  encodeGmxCreateDepositCalldata,
  GMX_CREATE_DEPOSIT_ABI_FRAGMENT,
  gmxCreateDepositAbi,
  stripGmxGmDepositOnChainMetadata,
} from "../../src/services/adapters/gmx-gm-deposit-encode";
import {
  assertGmxGmDepositMulticallLegs,
  buildGmxGmDepositMulticallCalls,
  buildGmxGmDepositRouterMulticall,
  decodeGmxGmDepositMulticallLegs,
} from "../../src/services/adapters/gmx-gm-deposit-multicall";

const USER = getAddress("0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F");
const MARKET = GMX_GM_ETH_USDC_MARKET;
const EXEC_FEE = 10n ** 15n;
const USDC_10 = 10_000_000n;
const WETH_HALF = 1_428_571_428_571_428n; // ~$5 @ $3500

function encodeGmxReferenceCreateDeposit(payload: ReturnType<typeof buildGmxGmUsdcOnlyDepositPayload>): Hex {
  const wire = buildGmxCreateDepositWireParams(payload, MARKET);
  const sdkAbi = parseAbi([GMX_CREATE_DEPOSIT_ABI_FRAGMENT]);
  return encodeFunctionData({ abi: sdkAbi, functionName: "createDeposit", args: [wire] });
}

describe("gmx-gm-deposit-encode", () => {
  it("buildGmxCreateDepositWireParams aligns ETH/USDC market tokens (USDC-only)", () => {
    const payload = buildGmxGmUsdcOnlyDepositPayload({ receiver: USER, usdcAmount: USDC_10 });
    const wire = buildGmxCreateDepositWireParams(payload, MARKET);
    expect(wire.addresses.market).toBe(MARKET);
    expect(wire.addresses.initialLongToken).toBe(GMX_GM_ETH_USDC_LONG_TOKEN);
    expect(wire.addresses.initialShortToken).toBe(GMX_GM_ETH_USDC_SHORT_TOKEN);
    expect(wire.addresses.receiver).toBe(USER);
    expect(wire.executionFee).toBeGreaterThan(0n);
    expect(wire.dataList).toEqual([]);
    const audit = auditGmxGmDepositWireParams(wire, MARKET);
    expect(audit.ok).toBe(true);
    assertGmxGmDepositWire(wire, MARKET);
  });

  it("encodeGmxCreateDepositCalldata round-trips ABI decode", () => {
    const payload = stripGmxGmDepositOnChainMetadata(
      buildGmxGmUsdcOnlyDepositPayload({ receiver: USER, usdcAmount: USDC_10, executionFeeWei: EXEC_FEE.toString() }),
    );
    const calldata = encodeGmxCreateDepositCalldata(payload, MARKET);
    const decoded = decodeFunctionData({ abi: gmxCreateDepositAbi, data: calldata });
    expect(decoded.functionName).toBe("createDeposit");
    expect(decoded.args[0].addresses.market).toBe(MARKET);
    expect(decoded.args[0].dataList).toEqual([]);
  });

  it("matches reference SDK encodeFunctionData serialization (USDC-only)", () => {
    const payload = stripGmxGmDepositOnChainMetadata(
      buildGmxGmUsdcOnlyDepositPayload({ receiver: USER, usdcAmount: USDC_10, executionFeeWei: EXEC_FEE.toString() }),
    );
    const ours = encodeGmxCreateDepositCalldata(payload, MARKET);
    const ref = encodeGmxReferenceCreateDeposit(payload);
    expect(ours).toBe(ref);
  });

  it("dual-token deposit wires both market tokens with independent amounts", () => {
    const payload = buildGmxGmDualTokenDepositPayload({
      receiver: USER,
      longTokenAmount: WETH_HALF,
      shortTokenAmount: USDC_10,
      executionFeeWei: EXEC_FEE.toString(),
    });
    expect(payload.longTokenAmount).toBe(WETH_HALF.toString());
    expect(payload.shortTokenAmount).toBe(USDC_10.toString());
    const { calls } = buildGmxGmDepositMulticallCalls({ payload, market: MARKET });
    expect(calls).toHaveLength(4);
    const legs = decodeGmxGmDepositMulticallLegs(calls);
    expect(legs.sendWnt.receiver).toBe(GMX_DEPOSIT_VAULT_ARBITRUM);
    expect(legs.tokenTransfers).toHaveLength(2);
    assertGmxGmDepositMulticallLegs({
      calls,
      depositVault: GMX_DEPOSIT_VAULT_ARBITRUM,
      executionFee: EXEC_FEE,
      longTokenAmount: WETH_HALF,
      shortTokenAmount: USDC_10,
    });
  });

  it("USDC-only multicall: sendWnt → sendTokens → createDeposit", () => {
    const payload = buildGmxGmUsdcOnlyDepositPayload({
      receiver: USER,
      usdcAmount: USDC_10,
      executionFeeWei: EXEC_FEE.toString(),
    });
    const { calls, data, value, executionFee } = buildGmxGmDepositRouterMulticall(payload, MARKET);
    expect(calls).toHaveLength(3);
    expect(value).toBe(executionFee);
    expect(data.startsWith("0xac9650d8")).toBe(true);
    const legs = decodeGmxGmDepositMulticallLegs(calls);
    expect(legs.tokenTransfers).toHaveLength(1);
    expect(legs.tokenTransfers[0].token).toBe(GMX_GM_ETH_USDC_SHORT_TOKEN);
    expect(legs.tokenTransfers[0].amount).toBe(USDC_10);
    expect(legs.createDeposit).toBe(encodeGmxReferenceCreateDeposit(payload));
  });

  it("buildGmxGmDepositFromLegacyInput maps sizeUsd to USDC short leg", () => {
    const payload = buildGmxGmDepositFromLegacyInput({ marketToken: MARKET, sizeUsd: 10, receiver: USER });
    expect(payload.shortTokenAmount).toBe(USDC_10.toString());
    expect(payload.longTokenAmount).toBe("0");
  });

  it("buildGmxGmDepositUnsignedPayload rejects zero amounts", () => {
    expect(() =>
      buildGmxGmDepositUnsignedPayload({ marketToken: MARKET, receiver: USER, longTokenAmount: 0n, shortTokenAmount: 0n }),
    ).toThrow(/GMX_GM_DEPOSIT_AMOUNTS/);
  });
});
