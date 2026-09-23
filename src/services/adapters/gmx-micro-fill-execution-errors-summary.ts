/** GMX micro-fill execution error formatting and context builders. */
import type { Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { GMX_V2_EXCHANGE_ROUTER_ARBITRUM } from "../../config/gmx-revenue";
import { extractGmxSimulateRevertDetails } from "./gmx-micro-fill-router-encode";
import type { GmxMicroFillExecutionContext } from "./gmx-micro-fill-execution-errors.types";
import { buildGmxMicroFillErrorSuggestions, formatGmxMicroFillUsdc } from "./gmx-micro-fill-execution-errors-suggestions";

export function formatGmxMicroFillErrorSummary(
  cause: unknown,
  ctx: GmxMicroFillExecutionContext,
): string {
  const details = extractGmxSimulateRevertDetails(cause);
  const headline = cause instanceof Error
    ? ((cause as Error & { shortMessage?: string }).shortMessage ?? cause.message)
    : String(cause);
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "GMX Micro-Fill Execution Failed",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `Step: ${ctx.step}`,
    `Router: ${ctx.router ?? GMX_V2_EXCHANGE_ROUTER_ARBITRUM}`,
    `Owner: ${ctx.owner ?? "n/a"}`,
    `Market: ${ctx.market ?? "n/a"}`,
    `Collateral: ${ctx.collateralUsd ?? formatGmxMicroFillUsdc(ctx.collateralRaw)}`,
    `Execution fee (wei): ${ctx.executionFeeWei ?? "n/a"}`,
    `Dispatch: ${ctx.dispatchMode ?? "n/a"}`,
    `Error: ${headline}`,
  ];
  if (ctx.decodedOnChainRevert) lines.push(`On-chain revert: ${ctx.decodedOnChainRevert}`);
  if (details.message && details.message !== headline) lines.push(`Revert: ${details.message}`);
  if (details.rawData) lines.push(`rawData: ${details.rawData}`);
  lines.push("── Suggestions ──");
  for (const tip of buildGmxMicroFillErrorSuggestions(cause, ctx)) lines.push(`• ${tip}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

export function printGmxMicroFillError(cause: unknown, ctx: GmxMicroFillExecutionContext): void {
  console.error(formatGmxMicroFillErrorSummary(cause, ctx));
}

export function contextFromPayload(
  payload: GmxV2UnsignedOrderPayload,
  owner: Hex,
  step: string,
  extra?: Partial<GmxMicroFillExecutionContext>,
): GmxMicroFillExecutionContext {
  const collateralRaw = payload.numbers.initialCollateralDeltaAmount;
  return {
    step,
    router: GMX_V2_EXCHANGE_ROUTER_ARBITRUM,
    owner,
    market: payload.addresses.market,
    collateralRaw,
    collateralUsd: formatGmxMicroFillUsdc(collateralRaw),
    executionFeeWei: payload.numbers.executionFee,
    ...extra,
  };
}
