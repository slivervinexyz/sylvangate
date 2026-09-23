/**
 * GMX v2 Arbitrum adapter — IArbitrumDexAdapter (RPC fallback + DataStore reader bindings).
 */

import type {
  ArbitrumDexHealthResult,
  ArbitrumFundingBorrowInput,
  ArbitrumFundingBorrowRates,
  ArbitrumMarketDepthInput,
  ArbitrumMarketDepthSnapshot,
  ArbitrumUnsignedHedgeOrder,
  ArbitrumUnsignedHedgeOrderInput,
  IArbitrumDexAdapter,
} from "./arbitrum-adapter";
import {
  GMX_V2_ADAPTER_ID,
  type GmxV2AdapterOptions,
  type GmxV2ExtendedMarketInfo,
  type GmxV2ResolvedMarket,
} from "./gmx-v2-adapter.types";
import {
  fetchGmxLiveContext,
  resolveGmxMarket,
  spreadBpsFromLiquidity,
  type GmxV2LiveContext,
} from "./gmx-v2-adapter.utils";
import {
  getMarket,
  getMarketPrices,
  getMarketReserveMemory,
  type GmxDataStoreMarketPrices,
  type GmxDataStoreMarketView,
} from "./gmx-v2-adapter-reader";
import { buildGmxV2UnsignedOrderPayload } from "./gmx-v2-order-payload";
import { fetchSplitBorrowRates, setGmxDataStoreStatusCache } from "./gmx-v2-datastore";
import { poolWeightsFromGmxMarket } from "../yield/gmx-v2-price-impact";
import { resolveGmxAdapterOptsFromEnv } from "../yield/multi-wallet-yield-router";
import type { MultiWalletYieldEnv } from "../yield/multi-wallet-yield-router";

export {
  getMarket,
  getMarketPrices,
  getMarketReserveMemory,
  type GmxDataStoreMarketPrices,
  type GmxDataStoreMarketView,
  type GmxDataStoreReserveMemory,
} from "./gmx-v2-adapter-reader";

const DEFAULT_ORDER_TTL_MS = 120_000;

export class GmxV2ArbitrumAdapter implements IArbitrumDexAdapter {
  readonly venueId = GMX_V2_ADAPTER_ID;
  readonly displayName = "GMX v2 (Arbitrum)";

  constructor(private readonly opts: GmxV2AdapterOptions = {}) {}

  private async resolveLiveMarket(symbol: string): Promise<{
    ctx: GmxV2LiveContext;
    resolved: GmxV2ResolvedMarket;
    market: GmxDataStoreMarketView;
    prices: GmxDataStoreMarketPrices;
  }> {
    const ctx = await fetchGmxLiveContext(this.opts);
    const resolved = resolveGmxMarket(ctx, symbol);
    return { ctx, resolved, market: getMarket(resolved), prices: getMarketPrices(resolved) };
  }

  async getMarketDepth(input: ArbitrumMarketDepthInput): Promise<ArbitrumMarketDepthSnapshot> {
    const { resolved, market } = await this.resolveLiveMarket(input.symbol);
    const half = market.poolLiquidityUsd / 2;
    return {
      venue: this.venueId,
      symbol: market.symbol,
      market: input.market ?? "perp",
      bidDepthUsd: half,
      askDepthUsd: half,
      midPriceUsd: resolved.midPriceUsd,
      spreadBps: spreadBpsFromLiquidity(market.poolLiquidityUsd),
      gmPoolLiquidityUsd: market.poolLiquidityUsd,
      fetchedAt: resolved.staleTimestamp ?? new Date().toISOString(),
    };
  }

  async getFundingAndBorrowRates(
    input: ArbitrumFundingBorrowInput,
  ): Promise<ArbitrumFundingBorrowRates> {
    const { resolved, market, prices } = await this.resolveLiveMarket(input.symbol);
    const info = resolved.info as GmxV2ExtendedMarketInfo;
    await getMarketReserveMemory(market, prices, info, this.opts);
    const side = input.side ?? "short";
    const split = await fetchSplitBorrowRates({
      market: {
        marketToken: market.marketToken,
        longToken: market.longToken,
        shortToken: market.shortToken,
      },
      opts: this.opts,
      fallback: {
        borrowingRateLong: info.borrowingRateLong,
        borrowingRateShort: info.borrowingRateShort,
        fundingRateLong: info.fundingRateLong,
        fundingRateShort: info.fundingRateShort,
      },
    });
    const borrowRateHourly =
      side === "long" ? split.longBorrowRateHourly : split.shortBorrowRateHourly;
    const fetchedAt = resolved.staleTimestamp ?? new Date().toISOString();
    setGmxDataStoreStatusCache({
      symbol: market.symbol,
      marketToken: market.marketToken,
      longBorrowRateHourly: split.longBorrowRateHourly,
      shortBorrowRateHourly: split.shortBorrowRateHourly,
      fundingRateHourly: split.fundingRateHourly,
      source: split.source,
      fetchedAt,
    });
    return {
      venue: this.venueId,
      symbol: market.symbol,
      side,
      fundingRateHourly: split.fundingRateHourly,
      borrowRateHourly,
      longBorrowRateHourly: split.longBorrowRateHourly,
      shortBorrowRateHourly: split.shortBorrowRateHourly,
      netCarryHourly: split.fundingRateHourly - borrowRateHourly,
      fetchedAt,
    };
  }

  async buildUnsignedHedgeOrder(
    input: ArbitrumUnsignedHedgeOrderInput,
  ): Promise<ArbitrumUnsignedHedgeOrder> {
    const { resolved, market } = await this.resolveLiveMarket(input.symbol);
    const now = this.opts.now?.() ?? Date.now();
    const ttl = this.opts.orderTtlMs ?? DEFAULT_ORDER_TTL_MS;
    const pool = poolWeightsFromGmxMarket(resolved.info, resolved.midPriceUsd);
    const payload = buildGmxV2UnsignedOrderPayload(
      {
        side: input.side,
        sizeUsd: input.sizeUsd,
        reduceOnly: input.reduceOnly,
        maxSlippageBps: input.maxSlippageBps,
        clientOrderId: input.clientOrderId,
        marketToken: market.marketToken,
        midPriceUsd: resolved.midPriceUsd,
        pool,
        uiFeeReceiver: input.uiFeeReceiver,
        referralCode: input.referralCode,
        allowStaleOracle: input.allowStaleOracle,
      },
      this.opts,
    );

    return {
      venue: this.venueId,
      symbol: market.symbol,
      side: input.side,
      sizeUsd: input.sizeUsd,
      estimatedNotionalUsd: input.sizeUsd,
      payload: payload as unknown as Record<string, unknown>,
      expiresAtMs: now + ttl,
    };
  }

  async checkHealth(): Promise<ArbitrumDexHealthResult> {
    const t0 = performance.now();
    try {
      const ctx = await fetchGmxLiveContext(this.opts);
      const hardFail = ctx.markets.length === 0 && !ctx.staleTimestamp;
      return {
        ok: !hardFail && !ctx.degraded,
        venue: this.venueId,
        latencyMs: performance.now() - t0,
        reasons: ctx.degradationReasons,
        staleTimestamp: ctx.staleTimestamp,
        degraded: ctx.degraded,
        rpcProvider: ctx.rpc.rpcProvider,
      };
    } catch (err) {
      return {
        ok: false,
        venue: this.venueId,
        latencyMs: performance.now() - t0,
        reasons: [err instanceof Error ? err.message : String(err)],
        staleTimestamp: new Date().toISOString(),
        degraded: true,
      };
    }
  }
}

export const gmxV2ArbitrumAdapter = new GmxV2ArbitrumAdapter();

/** Factory — binds GMX v2 adapter to worker env (uiFeeReceiver + referral SSOT). */
export function createGmxV2ArbitrumAdapterFromEnv(
  env: Pick<MultiWalletYieldEnv, "GMX_UI_FEE_RECEIVER">,
): GmxV2ArbitrumAdapter {
  return new GmxV2ArbitrumAdapter(resolveGmxAdapterOptsFromEnv(env));
}
