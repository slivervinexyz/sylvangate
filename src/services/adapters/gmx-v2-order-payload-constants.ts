import {
  GMX_REFERRAL_CODE_BYTES32,
  GMX_UI_FEE_BPS,
  GMX_UI_FEE_RECEIVER,
} from "../../config/gmx-revenue";
import { DEFAULT_GMX_EXECUTION_FEE_WEI } from "../risk/arbitrum-gas-guard";

export { DEFAULT_GMX_EXECUTION_FEE_WEI };
export {
  GMX_FLOAT_PRECISION,
  GMX_PAYLOAD_EXECUTION_FEE_TRIP,
  GMX_PAYLOAD_PRICE_IMPACT_TRIP,
  toGmxPrice30,
  toGmxUsd30,
} from "./gmx-v2-order-payload-guards";

export const GMX_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export { GMX_USDC_ARBITRUM } from "../../config/venue-execution-constants";
export const GMX_DEFAULT_UI_FEE_RECEIVER = GMX_UI_FEE_RECEIVER;
export { GMX_UI_FEE_BPS };
export const GMX_ZERO_REFERRAL_CODE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
export const GMX_DEFAULT_REFERRAL_CODE = GMX_REFERRAL_CODE_BYTES32;
export const GMX_MAX_SLIPPAGE_BPS = 100 as const;
export const GMX_DEFAULT_SLIPPAGE_BPS = 30 as const;
export const GMX_DEFAULT_CALLBACK_GAS_LIMIT = "0" as const;
export { USDC_DECIMALS } from "../../config/venue-execution-constants";
