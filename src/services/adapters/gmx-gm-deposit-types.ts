/** GMX v2 GM Pool deposit wire + unsigned payload types (IDepositUtils.CreateDepositParams). */
import type { Hex } from "viem";

export type GmxGmDepositWireAddresses = {
  receiver: Hex;
  callbackContract: Hex;
  uiFeeReceiver: Hex;
  market: Hex;
  initialLongToken: Hex;
  initialShortToken: Hex;
  longTokenSwapPath: readonly Hex[];
  shortTokenSwapPath: readonly Hex[];
};

export type GmxGmDepositWireParams = {
  addresses: GmxGmDepositWireAddresses;
  minMarketTokens: bigint;
  shouldUnwrapNativeToken: boolean;
  executionFee: bigint;
  callbackGasLimit: bigint;
  dataList: readonly Hex[];
};

/** Unsigned deposit intent — token amounts are sent via sendTokens, not in CreateDepositParams. */
export type GmxGmDepositUnsignedPayload = {
  addresses: {
    receiver: string;
    callbackContract?: string;
    uiFeeReceiver?: string;
    market: string;
    initialLongToken: string;
    initialShortToken: string;
    longTokenSwapPath?: readonly string[];
    shortTokenSwapPath?: readonly string[];
  };
  longTokenAmount: string;
  shortTokenAmount: string;
  minMarketTokens: string;
  shouldUnwrapNativeToken: boolean;
  executionFee: string;
  callbackGasLimit?: string;
  dataList?: readonly string[];
};

export type GmxGmDepositTokenTransfer = {
  token: Hex;
  destination: Hex;
  amount: bigint;
};

export type GmxGmDepositBuildInput = {
  marketToken: string;
  receiver: string;
  longTokenAmount?: string | bigint;
  shortTokenAmount?: string | bigint;
  /** Convenience: derive USDC short leg from USD (6-dec). Ignored when shortTokenAmount set. */
  shortTokenUsd?: number;
  /** Convenience: derive WETH long leg from USD at ethPriceUsd (18-dec). */
  longTokenUsd?: number;
  ethPriceUsd?: number;
  minMarketTokens?: string | bigint;
  shouldUnwrapNativeToken?: boolean;
  executionFeeWei?: string;
  callbackGasLimit?: string;
  uiFeeReceiver?: string;
  dataList?: readonly string[];
};
