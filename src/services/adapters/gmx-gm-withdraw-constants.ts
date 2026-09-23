/** GMX v2 GM Pool withdrawal — Arbitrum SSOT constants. */
import { getAddress } from "viem";
import { GMX_ETH_USD_MARKET_TOKEN } from "../../config/gmx-markets";

export const GMX_WITHDRAWAL_VAULT_ARBITRUM = getAddress("0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55");
export const GMX_GM_ETH_USDC_MARKET = getAddress(GMX_ETH_USD_MARKET_TOKEN);
/** GMX v2 Router — official `sendTokens` approve target (gmx-synthetics arbitrum-deployments). */
export const GMX_V2_ROUTER_ARBITRUM = getAddress("0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6");
/** Legacy Synthetics Router approve (superseded by Router for `sendTokens`). */
export const GMX_SYNTHETICS_ROUTER_ARBITRUM = getAddress("0xaBBc7805d812eA10e7D47d54169b8922596f9a0c");
/** GM LP approve target before ExchangeRouter.multicall withdrawal. */
export const GMX_GM_WITHDRAW_TOKEN_SPENDERS = [GMX_V2_ROUTER_ARBITRUM] as const;

/** Official user-side GM withdrawal: sendWnt → sendTokens(GM) → createWithdrawal. */
export const GMX_GM_WITHDRAW_MULTICALL_METHODS = ["sendWnt", "sendTokens", "createWithdrawal"] as const;
