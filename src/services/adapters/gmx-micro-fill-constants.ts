/** GMX v2 micro-fill sizing / oracle URL constants. */
import { getAddress, parseEther } from "viem";
import { GMX_V2_EXCHANGE_ROUTER_ARBITRUM } from "../../config/gmx-revenue";
import { GMX_ETH_USD_MARKET_TOKEN } from "../../config/gmx-markets";
import { GMX_USDC_ARBITRUM, USDC_DECIMALS } from "./gmx-v2-order-payload-constants";
import { GMX_FLOAT_PRECISION } from "./gmx-v2-order-payload-guards";
import { GMX_ORDER_VAULT_ARBITRUM } from "./gmx-market-increase-multicall";

export { GMX_ORDER_VAULT_ARBITRUM, GMX_USDC_ARBITRUM };
export const GMX_COLLATERAL_SPENDER_ARBITRUM = getAddress(GMX_V2_EXCHANGE_ROUTER_ARBITRUM);
/** GMX v2 Router — required USDC spender for MarketIncrease sendTokens (≠ ExchangeRouter). */
export const GMX_V2_ROUTER_ARBITRUM = getAddress("0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6");
export const GMX_MICRO_FILL_TOKEN_SPENDERS = [
  GMX_V2_ROUTER_ARBITRUM,
  GMX_COLLATERAL_SPENDER_ARBITRUM,
] as const;
export const MICRO_FILL_MIN_POSITION_USD = 10;
/** Keeper-safe WNT floor for MarketDecrease executionFee / sendWnt msg.value (Arbitrum 42161). */
export const GMX_MARKET_DECREASE_EXECUTION_FEE_MIN_WEI = parseEther("0.0008");
export const MICRO_FILL_COLLATERAL_USD = 10;
export const MICRO_FILL_LEVERAGE_X = 1;
export const MICRO_FILL_SIZE_DELTA_USD_30 = 10n * 10n ** 30n;
export const MICRO_FILL_COLLATERAL_USDC = BigInt(MICRO_FILL_COLLATERAL_USD) * 10n ** BigInt(USDC_DECIMALS);
export const GMX_ORACLE_TICKERS_URL = "https://arbitrum-api.gmxinfra.io/prices/tickers";
export const GMX_MARKETS_INFO_URL = "https://arbitrum-api.gmxinfra.io/markets/info";
export const MICRO_FILL_ETH_USDC_MARKET = getAddress(GMX_ETH_USD_MARKET_TOKEN);
export const MICRO_FILL_SLIPPAGE_BPS = 100;
/** MarketDecrease short cover — buy-back slippage (105% oracle cap). */
export const MICRO_FILL_DECREASE_SLIPPAGE_BPS = 500;
export const GMX_ORACLE_PRICE_PRECISION_30 = GMX_FLOAT_PRECISION;
export const GMX_MARKET_INCREASE_TRIGGER_PRICE_30 = 0n;
