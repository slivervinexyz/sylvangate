/**
 * GMX v2 ExchangeRouter.createWithdrawal calldata — IWithdrawalUtils.CreateWithdrawalParams alignment.
 *
 * @see https://docs.gmx.io/docs/api/contracts/exchange-router/
 * @see https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/withdrawal/IWithdrawalUtils.sol
 */
import { encodeFunctionData, getAddress, isHex, parseAbi, type Hex } from "viem";
import { encodeGmxDataList } from "./gmx-create-order-encode";
import { GMX_GM_ETH_USDC_MARKET } from "./gmx-gm-withdraw-constants";
import type { GmxGmWithdrawUnsignedPayload, GmxGmWithdrawWireParams } from "./gmx-gm-withdraw-types";
import { GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";

/** gmx-interface ExchangeRouter.createWithdrawal ABI fragment. */
export const GMX_CREATE_WITHDRAWAL_ABI_FRAGMENT =
  "function createWithdrawal(((address receiver, address callbackContract, address uiFeeReceiver, address market, address[] longTokenSwapPath, address[] shortTokenSwapPath) addresses, uint256 minLongTokenAmount, uint256 minShortTokenAmount, bool shouldUnwrapNativeToken, uint256 executionFee, uint256 callbackGasLimit, bytes32[] dataList) params) payable returns (bytes32)";

export const gmxCreateWithdrawalAbi = parseAbi([GMX_CREATE_WITHDRAWAL_ABI_FRAGMENT]);

const ZERO = GMX_ZERO_ADDRESS as Hex;

function addr(v: string): Hex {
  const t = v.trim();
  if (!t || t === "0x" || t === "0x0" || /^0x0{1,39}$/i.test(t)) return ZERO;
  return getAddress(t as Hex);
}

export function resolveGmxGmWithdrawMarket(market: Hex = GMX_GM_ETH_USDC_MARKET): Hex {
  const m = getAddress(market);
  if (m !== GMX_GM_ETH_USDC_MARKET) {
    throw new Error(`GMX_GM_WITHDRAW_MARKET: unsupported market ${m}`);
  }
  return m;
}

export function buildGmxCreateWithdrawalWireParams(
  payload: GmxGmWithdrawUnsignedPayload,
  market?: Hex,
): GmxGmWithdrawWireParams {
  const resolvedMarket = resolveGmxGmWithdrawMarket(market ?? (payload.addresses.market as Hex));
  const gmAmount = BigInt(payload.marketTokenAmount);
  if (gmAmount <= 0n) {
    throw new Error("GMX_GM_WITHDRAW_AMOUNT: marketTokenAmount must be > 0");
  }
  return {
    addresses: {
      receiver: addr(payload.addresses.receiver),
      callbackContract: addr(payload.addresses.callbackContract || ZERO),
      uiFeeReceiver: addr(payload.addresses.uiFeeReceiver || ZERO),
      market: resolvedMarket,
      longTokenSwapPath: (payload.addresses.longTokenSwapPath ?? []).map((p) => addr(p)),
      shortTokenSwapPath: (payload.addresses.shortTokenSwapPath ?? []).map((p) => addr(p)),
    },
    minLongTokenAmount: BigInt(payload.minLongTokenAmount),
    minShortTokenAmount: BigInt(payload.minShortTokenAmount),
    shouldUnwrapNativeToken: payload.shouldUnwrapNativeToken,
    executionFee: BigInt(payload.executionFee),
    callbackGasLimit: BigInt(payload.callbackGasLimit ?? "0"),
    dataList: encodeGmxDataList(payload.dataList ?? []),
  };
}

export function encodeGmxCreateWithdrawalCalldata(
  payload: GmxGmWithdrawUnsignedPayload,
  market?: Hex,
): Hex {
  const params = buildGmxCreateWithdrawalWireParams(payload, market);
  return encodeFunctionData({ abi: gmxCreateWithdrawalAbi, functionName: "createWithdrawal", args: [params] });
}

export function stripGmxGmWithdrawOnChainMetadata(payload: GmxGmWithdrawUnsignedPayload): GmxGmWithdrawUnsignedPayload {
  return {
    ...payload,
    dataList: [],
    addresses: { ...payload.addresses, uiFeeReceiver: GMX_ZERO_ADDRESS },
  };
}

export function assertGmxGmWithdrawDataListWire(dataList: readonly Hex[]): void {
  for (const entry of dataList) {
    if (!isHex(entry) || entry.length !== 66) {
      throw new Error(`GMX_GM_WITHDRAW_DATALIST: expected bytes32 hex, got len ${entry.length}`);
    }
  }
}
