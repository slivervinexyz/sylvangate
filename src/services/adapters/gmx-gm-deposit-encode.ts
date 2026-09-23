/**
 * GMX v2 ExchangeRouter.createDeposit calldata — IDepositUtils.CreateDepositParams alignment.
 *
 * @see https://docs.gmx.io/docs/api/contracts/exchange-router/
 * @see https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/deposit/IDepositUtils.sol
 */
import { encodeFunctionData, getAddress, isHex, parseAbi, type Hex } from "viem";
import { encodeGmxDataList } from "./gmx-create-order-encode";
import {
  GMX_GM_ETH_USDC_LONG_TOKEN,
  GMX_GM_ETH_USDC_MARKET,
  GMX_GM_ETH_USDC_SHORT_TOKEN,
} from "./gmx-gm-deposit-constants";
import type { GmxGmDepositUnsignedPayload, GmxGmDepositWireParams } from "./gmx-gm-deposit-types";
import { GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";

/** gmx-interface ExchangeRouter.createDeposit ABI fragment. */
export const GMX_CREATE_DEPOSIT_ABI_FRAGMENT =
  "function createDeposit(((address receiver, address callbackContract, address uiFeeReceiver, address market, address initialLongToken, address initialShortToken, address[] longTokenSwapPath, address[] shortTokenSwapPath) addresses, uint256 minMarketTokens, bool shouldUnwrapNativeToken, uint256 executionFee, uint256 callbackGasLimit, bytes32[] dataList) params) payable returns (bytes32)";

export const gmxCreateDepositAbi = parseAbi([GMX_CREATE_DEPOSIT_ABI_FRAGMENT]);

const ZERO = GMX_ZERO_ADDRESS as Hex;

function addr(v: string): Hex {
  const t = v.trim();
  if (!t || t === "0x" || t === "0x0" || /^0x0{1,39}$/i.test(t)) return ZERO;
  return getAddress(t as Hex);
}

/** Market long/short tokens are always wired; amounts come from DepositVault.recordTransferIn. */
export function resolveGmxGmDepositMarketTokens(market: Hex = GMX_GM_ETH_USDC_MARKET): {
  market: Hex;
  longToken: Hex;
  shortToken: Hex;
} {
  const m = getAddress(market);
  if (m === GMX_GM_ETH_USDC_MARKET) {
    return { market: m, longToken: GMX_GM_ETH_USDC_LONG_TOKEN, shortToken: GMX_GM_ETH_USDC_SHORT_TOKEN };
  }
  throw new Error(`GMX_GM_DEPOSIT_MARKET: unsupported market ${m}`);
}

export function buildGmxCreateDepositWireParams(
  payload: GmxGmDepositUnsignedPayload,
  market?: Hex,
): GmxGmDepositWireParams {
  const tokens = resolveGmxGmDepositMarketTokens(market ?? (payload.addresses.market as Hex));
  const longAmt = BigInt(payload.longTokenAmount);
  const shortAmt = BigInt(payload.shortTokenAmount);
  if (longAmt === 0n && shortAmt === 0n) {
    throw new Error("GMX_GM_DEPOSIT_AMOUNTS: at least one token amount must be > 0");
  }
  return {
    addresses: {
      receiver: addr(payload.addresses.receiver),
      callbackContract: addr(payload.addresses.callbackContract || ZERO),
      uiFeeReceiver: addr(payload.addresses.uiFeeReceiver || ZERO),
      market: tokens.market,
      initialLongToken: addr(payload.addresses.initialLongToken || tokens.longToken),
      initialShortToken: addr(payload.addresses.initialShortToken || tokens.shortToken),
      longTokenSwapPath: (payload.addresses.longTokenSwapPath ?? []).map((p) => addr(p)),
      shortTokenSwapPath: (payload.addresses.shortTokenSwapPath ?? []).map((p) => addr(p)),
    },
    minMarketTokens: BigInt(payload.minMarketTokens),
    shouldUnwrapNativeToken: payload.shouldUnwrapNativeToken,
    executionFee: BigInt(payload.executionFee),
    callbackGasLimit: BigInt(payload.callbackGasLimit ?? "0"),
    dataList: encodeGmxDataList(payload.dataList ?? []),
  };
}

export function encodeGmxCreateDepositCalldata(
  payload: GmxGmDepositUnsignedPayload,
  market?: Hex,
): Hex {
  const params = buildGmxCreateDepositWireParams(payload, market);
  return encodeFunctionData({ abi: gmxCreateDepositAbi, functionName: "createDeposit", args: [params] });
}

/** On-chain wire clears optional metadata (bytes32[] must stay bytes32, not bytes[]). */
export function stripGmxGmDepositOnChainMetadata(payload: GmxGmDepositUnsignedPayload): GmxGmDepositUnsignedPayload {
  return {
    ...payload,
    dataList: [],
    addresses: { ...payload.addresses, uiFeeReceiver: GMX_ZERO_ADDRESS },
  };
}

export function assertGmxGmDepositDataListWire(dataList: readonly Hex[]): void {
  for (const entry of dataList) {
    if (!isHex(entry) || entry.length !== 66) {
      throw new Error(`GMX_GM_DEPOSIT_DATALIST: expected bytes32 hex, got len ${entry.length}`);
    }
  }
}
