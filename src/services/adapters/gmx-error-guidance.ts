/** GMX v2 error operator guidance + price/fee adjustment builders. */
import { MICRO_FILL_SLIPPAGE_BPS } from "./gmx-micro-fill-constants";
import {
  computeGmxAcceptablePriceFromOracleRaw,
  parseGmxIndexPrice30ToHuman,
} from "./gmx-micro-fill-pricing";
import type { GmxInterpretContext, GmxInterpretedError } from "./gmx-error-interpreter.types";

const ETH_INDEX_DECIMALS = 18;

function price30Human(raw: bigint): number {
  return parseGmxIndexPrice30ToHuman(raw, ETH_INDEX_DECIMALS);
}

function deltaBps(price: bigint, bound: bigint, isLong: boolean): number {
  if (bound === 0n) return 0;
  const diff = isLong ? bound - price : price - bound;
  return Number((diff * 10_000n) / bound);
}

export function buildGmxErrorAdjustments(
  errorName: string,
  args: readonly unknown[],
  ctx: GmxInterpretContext,
): GmxInterpretedError["adjustments"] {
  if (errorName === "OrderNotFulfillableAtAcceptablePrice" && args.length >= 2) {
    const price = BigInt(args[0] as bigint);
    const acceptable = BigInt(args[1] as bigint);
    const isLong = ctx.isLong ?? true;
    const oracle = ctx.oraclePriceRaw ?? price;
    const slippage = ctx.slippageBps ?? MICRO_FILL_SLIPPAGE_BPS;
    const suggested = computeGmxAcceptablePriceFromOracleRaw(oracle, isLong, slippage);
    return {
      acceptablePrice: {
        current: acceptable,
        suggested,
        deltaBps: deltaBps(price, acceptable, isLong),
        oracleHumanUsd: price30Human(oracle),
      },
    };
  }
  if (
    (errorName === "InsufficientExecutionFee" || errorName === "InsufficientWntAmountForExecutionFee")
    && args.length >= 2
  ) {
    const minimum = BigInt(args[0] as bigint);
    const current = BigInt(args[1] as bigint);
    return { executionFee: { current, minimum, deficit: minimum > current ? minimum - current : 0n } };
  }
  if (errorName === "InvalidOrderPrices" && args.length >= 4 && ctx.oraclePriceRaw) {
    const isLong = ctx.isLong ?? true;
    const slippage = ctx.slippageBps ?? MICRO_FILL_SLIPPAGE_BPS;
    const suggested = computeGmxAcceptablePriceFromOracleRaw(ctx.oraclePriceRaw, isLong, slippage);
    const current = ctx.acceptablePrice ?? 0n;
    return {
      acceptablePrice: {
        current,
        suggested,
        deltaBps: deltaBps(ctx.oraclePriceRaw, current, isLong),
        oracleHumanUsd: price30Human(ctx.oraclePriceRaw),
      },
    };
  }
  return undefined;
}

export function buildGmxErrorGuidance(
  errorName: string,
  args: readonly unknown[],
  ctx: GmxInterpretContext,
): string[] {
  const tips: string[] = [];
  const adj = buildGmxErrorAdjustments(errorName, args, ctx);
  if (errorName === "OrderNotFulfillableAtAcceptablePrice" && adj?.acceptablePrice) {
    const { current, suggested, deltaBps: d, oracleHumanUsd } = adj.acceptablePrice;
    tips.push(
      `Oracle execution price drifted ${d} bps outside acceptablePrice bound`,
      `Current acceptablePrice=${current} (${price30Human(current).toFixed(4)} USD 30-dec)`,
      `Suggested acceptablePrice=${suggested} (${price30Human(suggested).toFixed(4)} USD) from oracle ~$${oracleHumanUsd?.toFixed(2)} + ${ctx.slippageBps ?? MICRO_FILL_SLIPPAGE_BPS} bps`,
      "Refresh oracle ticker via fetchGmxIndexOracleTicker then applyMicroFillOrderPricing before encode",
    );
  }
  if (errorName === "InvalidOrderPrices" && args.length >= 4) {
    tips.push(
      `Oracle band min=${args[0]} max=${args[1]} trigger=${args[2]} orderType=${args[3]}`,
      "MarketIncrease: triggerPrice=0; acceptablePrice must bracket current oracle primary price for direction",
    );
    if (adj?.acceptablePrice) {
      tips.push(`Re-encode acceptablePrice=${adj.acceptablePrice.suggested} (delta ${adj.acceptablePrice.deltaBps} bps from prior)`);
    }
  }
  if (adj?.executionFee) {
    tips.push(
      `Raise executionFee from ${adj.executionFee.current} to >= ${adj.executionFee.minimum} wei (deficit ${adj.executionFee.deficit})`,
      "Use estimateGmxExecutionFeeWei from DataStore gas limits + 30% Arbitrum buffer",
    );
  }
  if (errorName === "MarketNotFound" && args[0]) {
    tips.push(`Market token ${args[0]} not in DataStore — verify gmx-markets SSOT / gmxinfra markets/info`);
  }
  if (["MaxPriceAgeExceeded", "OraclePriceOutdated", "GmInvalidBlockNumber", "SequencerDown"].includes(errorName)) {
    tips.push("Oracle stale — retry after fresh block; keeper path uses sendOraclePrices (not user multicall)");
  }
  if (["InsufficientCollateralUsd", "MinPositionSize", "InsufficientCollateralAmount"].includes(errorName)) {
    tips.push("Raise initialCollateralDeltaAmount / sizeDeltaUsd above GMX market minimum (micro-fill uses $10 USDC)");
  }
  if (errorName === "InsufficientWntAmountForExecutionFee") {
    tips.push("Ensure multicall msg.value == executionFee and sendWnt leg deposits WNT to OrderVault first");
  }
  if (ctx.market) tips.push(`Market context: ${ctx.market}`);
  return tips;
}
