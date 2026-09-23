/**
 * GMX v2 unsigned order/deposit payload builders — IBaseOrderUtils.CreateOrderParams alignment.
 */

export {
  DEFAULT_GMX_EXECUTION_FEE_WEI,
  GMX_DEFAULT_REFERRAL_CODE,
  GMX_DEFAULT_UI_FEE_RECEIVER,
  GMX_FLOAT_PRECISION,
  GMX_MAX_SLIPPAGE_BPS,
  GMX_PAYLOAD_EXECUTION_FEE_TRIP,
  GMX_PAYLOAD_PRICE_IMPACT_TRIP,
  GMX_UI_FEE_BPS,
  GMX_USDC_ARBITRUM,
  GMX_ZERO_ADDRESS,
  GMX_ZERO_REFERRAL_CODE,
  toGmxPrice30,
  toGmxUsd30,
  USDC_DECIMALS,
} from "./gmx-v2-order-payload-constants";

export {
  clampGmxMaxSlippageBps,
  estimateGmxMinOutputAmount,
  resolveGmxExecutionFeeWei,
  resolveGmxMinOutputAmount,
  resolveGmxReferralCode,
  resolveGmxUiFeeReceiver,
} from "./gmx-v2-order-payload-fees";

export {
  GMX_ORDER_TYPE_INDEX,
  type GmxV2BuildDepositPayloadInput,
  type GmxV2BuildUnsignedOrderInput,
  type GmxV2BuildWithdrawPayloadInput,
  type GmxV2OrderFeeConfig,
} from "./gmx-v2-order-payload.types";

export {
  buildGmxV2UnsignedDepositPayload,
  buildGmxV2UnsignedOrderPayload,
  buildGmxV2UnsignedWithdrawPayload,
  computeGmxAcceptablePrice,
  resolveGmxOrderType,
} from "./gmx-v2-order-payload-builders";
