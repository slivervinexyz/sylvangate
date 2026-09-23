/** Cross-DEX funding spread — GMX v2 vs HL / Vertex execution legs. */
import { HL_INFO_URL } from "../../adapters/hyperliquid";
import { fetchAllowlisted } from "../defense/rpc-whitelist";
import { gmxV2ArbitrumAdapter, type GmxV2ArbitrumAdapter } from "../adapters/gmx-v2-adapter";
import type { ArbitrumFundingBorrowRates } from "../adapters/arbitrum-adapter";
import { fundingHourlyToGrossApy } from "./rebalance-rules";
import {
  __readCrossSpreadCacheRef,
  __writeCrossSpreadCacheRef,
  computeCrossFundingSpread,
  type CrossSpreadLegSnapshot,
  type CrossSpreadResult,
  type ExecutionHedgeVenue,
} from "./cross-spread-cache";

export {
  MIN_CROSS_SPREAD_BPS,
  getCrossSpreadCache,
  __setCrossSpreadCacheForTests,
  computeCrossFundingSpread,
  evaluateCrossSpreadSoilGate,
  crossSpreadForSoil,
  type CrossSpreadLegSnapshot,
  type CrossSpreadResult,
  type CrossSpreadSoilInput,
  type ExecutionHedgeVenue,
} from "./cross-spread-cache";

export type ResolveCrossSpreadInput = {
  symbol: string;
  side?: "long" | "short";
  executionVenue?: ExecutionHedgeVenue;
  gmxAdapter?: GmxV2ArbitrumAdapter;
  gmxRates?: ArbitrumFundingBorrowRates;
  executionFundingHourly?: number;
  executionBorrowHourly?: number;
  fetchFn?: typeof fetch;
};

const VERTEX_QUERY = "https://gateway.prod.vertexprotocol.com/v1/query";

function legSnapshot(
  venue: CrossSpreadLegSnapshot["venue"],
  fundingRateHourly: number,
  borrowRateHourly: number,
): CrossSpreadLegSnapshot {
  const netCarryHourly = fundingRateHourly - borrowRateHourly;
  return {
    venue,
    fundingRateHourly,
    borrowRateHourly,
    netCarryHourly,
    grossApy: fundingHourlyToGrossApy(netCarryHourly),
  };
}

async function postJson<T>(url: string, body: unknown, fetchFn?: typeof fetch): Promise<T | null> {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as RequestInit;
  const res = fetchFn ? await fetchFn(url, init) : await fetchAllowlisted(url, init);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function fetchHyperliquidFundingHourly(
  symbol: string,
  options: { fetchFn?: typeof fetch; infoUrl?: string } = {},
): Promise<number> {
  const data = await postJson<
    [{ universe: Array<{ name: string }> }, Array<{ funding?: string }>]
  >(options.infoUrl ?? HL_INFO_URL, { type: "metaAndAssetCtxs" }, options.fetchFn);
  const coin = symbol.toUpperCase();
  const idx = data?.[0]?.universe?.findIndex((u) => u.name.toUpperCase() === coin) ?? -1;
  if (idx < 0) return 0;
  const funding = Number.parseFloat(data?.[1]?.[idx]?.funding ?? "0");
  return Number.isFinite(funding) ? funding : 0;
}

export async function fetchVertexFundingHourly(
  symbol: string,
  options: { fetchFn?: typeof fetch; fundingOverride?: number } = {},
): Promise<number> {
  if (options.fundingOverride !== undefined) return options.fundingOverride;
  const body = await postJson<{
    data?: { perp_products?: Array<{ symbol?: string; funding_rate_x18?: string }> };
  }>(VERTEX_QUERY, { type: "all_products" }, options.fetchFn);
  const key = symbol.toUpperCase();
  const product = body?.data?.perp_products?.find((p) =>
    (p.symbol ?? "").toUpperCase().includes(key),
  );
  if (!product?.funding_rate_x18) return 0;
  const hourly = Number(BigInt(product.funding_rate_x18)) / 1e18;
  return Number.isFinite(hourly) ? hourly : 0;
}

export async function resolveCrossDexFundingSpread(
  input: ResolveCrossSpreadInput,
): Promise<CrossSpreadResult> {
  const executionVenue = input.executionVenue ?? "hyperliquid";
  const gmxRates =
    input.gmxRates ??
    (await (input.gmxAdapter ?? gmxV2ArbitrumAdapter).getFundingAndBorrowRates({
      symbol: input.symbol,
      side: input.side ?? "short",
    }));
  const execFunding =
    input.executionFundingHourly ??
    (executionVenue === "hyperliquid"
      ? await fetchHyperliquidFundingHourly(input.symbol, { fetchFn: input.fetchFn })
      : await fetchVertexFundingHourly(input.symbol, { fetchFn: input.fetchFn }));
  const gmxLeg = legSnapshot("gmx-v2", gmxRates.fundingRateHourly, gmxRates.borrowRateHourly);
  const executionLeg = legSnapshot(executionVenue, execFunding, input.executionBorrowHourly ?? 0);
  const spread = computeCrossFundingSpread({
    gmxNetCarryHourly: gmxLeg.netCarryHourly,
    executionNetCarryHourly: executionLeg.netCarryHourly,
  });
  const next: CrossSpreadResult = {
    symbol: input.symbol.toUpperCase(),
    executionVenue,
    gmxLeg,
    executionLeg,
    ...spread,
    fetchedAt: gmxRates.fetchedAt,
  };
  __writeCrossSpreadCacheRef(next);
  return next;
}

export function peekCrossSpreadCache(): CrossSpreadResult | null {
  return __readCrossSpreadCacheRef();
}
