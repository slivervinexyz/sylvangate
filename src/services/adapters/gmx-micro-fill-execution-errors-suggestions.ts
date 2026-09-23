/** GMX micro-fill execution failure operator suggestions. */
import { GMX_COLLATERAL_SPENDER_ARBITRUM, extractGmxSimulateRevertDetails, isSilentGmxSimulateRevert } from "./gmx-micro-fill-router-encode";
import { MICRO_FILL_COLLATERAL_USD } from "./gmx-micro-fill-constants";
import { USDC_DECIMALS } from "./gmx-v2-order-payload-constants";
import type { GmxMicroFillExecutionContext } from "./gmx-micro-fill-execution-errors.types";

export function formatGmxMicroFillUsdc(raw?: string): string {
  if (!raw) return "n/a";
  try {
    const n = BigInt(raw);
    return `$${(Number(n) / 10 ** USDC_DECIMALS).toFixed(2)} USDC (${raw} raw)`;
  } catch {
    return raw;
  }
}

export function buildGmxMicroFillErrorSuggestions(cause: unknown, ctx: GmxMicroFillExecutionContext): string[] {
  const msg = cause instanceof Error ? cause.message : String(cause);
  const details = extractGmxSimulateRevertDetails(cause);
  const tips: string[] = [];
  const decoded = ctx.decodedOnChainRevert ?? details.decodedError ?? "";
  if (details.errorLabel === "InsufficientExecutionFee" || decoded.includes("InsufficientExecutionFee")) {
    tips.push("Raise executionFee — use dynamic GMX DataStore estimate (gasLimit × gasPrice + 30% buffer)");
  }
  if (details.errorLabel === "AcceptablePrice" || decoded.includes("OrderNotFulfillableAtAcceptablePrice") || decoded.includes("InvalidOrderPrices")) {
    tips.push("Refresh acceptablePrice from live oracle ticker + slippage bps; see interpretGmxRevertData adjustments");
  }
  if (details.errorLabel === "OracleStaleness" || decoded.includes("MaxPriceAgeExceeded") || decoded.includes("OraclePriceOutdated")) {
    tips.push("Oracle stale — retry on fresh block; user multicall cannot include sendOraclePrices (keeper-only)");
  }
  if (details.errorLabel === "MinCollateralUsd" || decoded.includes("InsufficientCollateralUsd") || decoded.includes("MinPositionSize")) {
    tips.push(`Raise initialCollateralDeltaAmount — GMX min collateral/position threshold; micro-fill uses $${MICRO_FILL_COLLATERAL_USD} USDC`);
  }
  if (details.errorLabel === "InvalidMarket" || decoded.includes("MarketNotFound") || decoded.includes("InvalidPositionMarket")) {
    tips.push("Confirm marketToken matches gmxinfra markets/info ETH/USDC SSOT");
  }
  if (decoded.includes("InsufficientWntAmountForExecutionFee")) {
    tips.push("Ensure multicall msg.value matches executionFee and sendWnt deposits WNT to OrderVault first");
  }
  if (ctx.step.includes("simulate") && isSilentGmxSimulateRevert(cause)) {
    tips.push("Local eth_call returned silent revert (rawData=0x); set BYPASS_SIMULATION=true to broadcast and inspect on-chain");
  }
  if (ctx.step.includes("on-chain") && !decoded && !details.rawData) {
    tips.push("Set GMX_DIAGNOSTIC_RPC_URL to a non-Alchemy Arbitrum RPC (e.g. https://arb1.arbitrum.io/rpc) to recover custom error data");
  }
  if (msg.includes("USDC_INSUFFICIENT") || msg.includes("COLLATERAL_INSUFFICIENT")) {
    tips.push(`Fund owner ${ctx.owner ?? "EOA/Kernel"} with at least ${ctx.collateralUsd ?? `$${MICRO_FILL_COLLATERAL_USD}`} USDC`);
  }
  if (msg.includes("allowance") || msg.includes("approve")) {
    tips.push(`Approve USDC for ExchangeRouter spender ${GMX_COLLATERAL_SPENDER_ARBITRUM}`);
  }
  if (msg.includes("GUARD_BLOCKED") || msg.includes("CRI_HARDLOCK")) {
    tips.push("Check oracle lag / gas guard; dry-run only: ALLOW_STALE_ORACLE=1 (BYPASS_SOIL_PROBE is forbidden)");
  }
  if (ctx.decodedOnChainRevert?.includes("[GMX:")) {
    tips.push(`GMX labeled revert: ${ctx.decodedOnChainRevert}`);
  }
  if (details.decodedError?.includes("Error(")) {
    tips.push(`GMX contract revert: ${details.decodedError}`);
  }
  if (details.rawData) {
    const selector = details.rawData.slice(0, 10);
    if (selector && selector !== "0x") {
      tips.push(`Custom error selector ${selector} — cross-check gmx-synthetics Errors.sol`);
    }
  }
  if (ctx.txHash) {
    tips.push(`Arbiscan: https://arbiscan.io/tx/${ctx.txHash}`);
  }
  if (tips.length === 0) {
    tips.push("Verify executionFee ETH, acceptablePrice 30-dec encoding, USDC balance, and Router multicall order (sendWnt→sendTokens→createOrder)");
  }
  return tips;
}
