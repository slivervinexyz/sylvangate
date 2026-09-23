/** GMX v2 GM Pool withdrawal wire + unsigned payload types (IWithdrawalUtils.CreateWithdrawalParams). */
import type { Hex } from "viem";
import type { GmxV2PoolWeights } from "../yield/gmx-v2-price-impact";

export type GmxGmWithdrawWireAddresses = {
  receiver: Hex;
  callbackContract: Hex;
  uiFeeReceiver: Hex;
  market: Hex;
  longTokenSwapPath: readonly Hex[];
  shortTokenSwapPath: readonly Hex[];
};

export type GmxGmWithdrawWireParams = {
  addresses: GmxGmWithdrawWireAddresses;
  minLongTokenAmount: bigint;
  minShortTokenAmount: bigint;
  shouldUnwrapNativeToken: boolean;
  executionFee: bigint;
  callbackGasLimit: bigint;
  dataList: readonly Hex[];
};

/** Unsigned withdrawal intent — GM amount is sent via sendTokens, not in CreateWithdrawalParams. */
export type GmxGmWithdrawUnsignedPayload = {
  addresses: {
    receiver: string;
    callbackContract?: string;
    uiFeeReceiver?: string;
    market: string;
    longTokenSwapPath?: readonly string[];
    shortTokenSwapPath?: readonly string[];
  };
  marketTokenAmount: string;
  minLongTokenAmount: string;
  minShortTokenAmount: string;
  shouldUnwrapNativeToken: boolean;
  executionFee: string;
  callbackGasLimit?: string;
  dataList?: readonly string[];
  sizeUsd?: number;
};

export type GmxGmWithdrawTokenTransfer = {
  token: Hex;
  destination: Hex;
  amount: bigint;
};

export type GmxGmWithdrawBuildInput = {
  marketToken: string;
  receiver: string;
  marketTokenAmount?: string | bigint;
  sizeUsd?: number;
  gmPriceUsd?: number;
  minLongTokenAmount?: string | bigint;
  minShortTokenAmount?: string | bigint;
  maxSlippageBps?: number;
  signedImpactBps?: number;
  shouldUnwrapNativeToken?: boolean;
  executionFeeWei?: string;
  callbackGasLimit?: string;
  uiFeeReceiver?: string;
  dataList?: readonly string[];
  pool?: GmxV2PoolWeights;
  skipFailClosedGuards?: boolean;
  allowStaleOracle?: boolean;
};
