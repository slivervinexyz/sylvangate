/**
 * GMX v2 unsigned withdraw payload builder — thin legacy wrapper over gmx-gm-withdraw-build.
 */
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import { buildGmxGmWithdrawFromLegacyInput } from "./gmx-gm-withdraw-build";
import { resolveGmxReferralCode } from "./gmx-v2-order-payload-fees";
import type { GmxV2BuildWithdrawPayloadInput } from "./gmx-v2-order-payload.types";

export function buildGmxV2UnsignedWithdrawPayload(
  input: GmxV2BuildWithdrawPayloadInput,
  opts: GmxV2AdapterOptions = {},
): Record<string, unknown> {
  const payload = buildGmxGmWithdrawFromLegacyInput(input, opts);
  const halfUsd = input.sizeUsd / 2;
  return {
    action: "withdraw",
    addresses: {
      receiver: payload.addresses.receiver,
      callbackContract: payload.addresses.callbackContract,
      uiFeeReceiver: payload.addresses.uiFeeReceiver,
      market: payload.addresses.market,
      longTokenSwapPath: payload.addresses.longTokenSwapPath ?? [],
      shortTokenSwapPath: payload.addresses.shortTokenSwapPath ?? [],
    },
    numbers: {
      marketTokenAmount: payload.marketTokenAmount,
      minLongTokenAmount: payload.minLongTokenAmount,
      minShortTokenAmount: payload.minShortTokenAmount,
      executionFee: payload.executionFee,
      callbackGasLimit: payload.callbackGasLimit ?? "0",
    },
    shouldUnwrapNativeToken: payload.shouldUnwrapNativeToken,
    referralCode: resolveGmxReferralCode(opts, input),
    gmTokenAmountUsd: input.sizeUsd.toFixed(2),
    longTokenAmountUsd: halfUsd.toFixed(2),
    shortTokenAmountUsd: halfUsd.toFixed(2),
  };
}
