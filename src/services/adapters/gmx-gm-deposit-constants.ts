/** GMX v2 GM Pool deposit — Arbitrum SSOT constants. */
import { getAddress } from "viem";
import {
  GMX_ETH_USD_LONG_TOKEN,
  GMX_ETH_USD_MARKET_TOKEN,
  GMX_ETH_USD_SHORT_TOKEN,
} from "../../config/gmx-markets";

export const GMX_DEPOSIT_VAULT_ARBITRUM = getAddress("0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55");
export const GMX_GM_ETH_USDC_MARKET = getAddress(GMX_ETH_USD_MARKET_TOKEN);
export const GMX_GM_ETH_USDC_LONG_TOKEN = getAddress(GMX_ETH_USD_LONG_TOKEN);
export const GMX_GM_ETH_USDC_SHORT_TOKEN = getAddress(GMX_ETH_USD_SHORT_TOKEN);

/** Official user-side single-token deposit: sendWnt → sendTokens → createDeposit. */
export const GMX_GM_DEPOSIT_SINGLE_MULTICALL_METHODS = [
  "sendWnt",
  "sendTokens",
  "createDeposit",
] as const;

/** Dual-token deposit: sendWnt → sendTokens(long) → sendTokens(short) → createDeposit. */
export const GMX_GM_DEPOSIT_DUAL_MULTICALL_METHODS = [
  "sendWnt",
  "sendTokens",
  "sendTokens",
  "createDeposit",
] as const;
