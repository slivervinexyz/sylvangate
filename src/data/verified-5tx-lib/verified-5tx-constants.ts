/**
 * Hyperliquid Testnet 5-TX verification — shared constants.
 */

export const HL_TESTNET_EXPLORER_TX_BASE =
  "https://app.hyperliquid-testnet.xyz/explorer/tx/" as const;

export const HL_TESTNET_EXPLORER_ADDRESS_BASE =
  "https://app.hyperliquid-testnet.xyz/explorer/address/" as const;

/** Grant HUD fallback when wallet is disconnected. */
export const HL_TESTNET_EXPLORER_FALLBACK_WALLET =
  "0x16762b0dc4bdd84d9ad4720b2beaf613ee77bcc2" as const;

export const VERIFIED_5TX_ORDER_COUNT = 5;
/** HL exchange hard floor per order (~$10 USD). */
export const HL_EXCHANGE_MIN_NOTIONAL_USD = 10;
/** Target notional per 5-TX leg — $12 headroom above HL floor. */
export const HL_LIVE_MIN_NOTIONAL_USD = 12;
/** Post lot-rounding safety floor — must stay above HL rejection threshold. */
export const HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD = 10.5;
export const VERIFIED_5TX_NOTIONAL_USD = HL_LIVE_MIN_NOTIONAL_USD;
export const VERIFIED_5TX_SYMBOL = "ETH";

/** Grant narrative baseline — unprotected market sweep slippage (no shield). */
export const BASELINE_LOSS_BPS_NO_SHIELD = 12.05;

/** HL testnet 5-TX aggregate (verified_5tx_results.json). */
export const VERIFIED_5TX_SAVED_USDC = 0.0086;
export const VERIFIED_5TX_SAVED_BPS = 1.72;
export const VERIFIED_INTERCEPT_PCT_V08 = 92.4;

/** Grant milestone saved bps (Step 1 notional math). */
export const VERSION_SAVED_BPS: Readonly<Record<"v0.8" | "v1.0" | "v1.5", number>> = {
  "v0.8": 1.72,
  "v1.0": 98,
  "v1.5": 142,
};
