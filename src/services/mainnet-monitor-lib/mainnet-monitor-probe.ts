import { FUNDING_ANOMALY_THRESHOLD } from "../../config/constants";
import { STALE_THRESHOLD_MS } from "../../config/risk-parameters";
import { PREFERRED } from "./mainnet-monitor-constants";
import { sumDepthUsd } from "./mainnet-monitor-depth";
import { postInfo } from "./mainnet-monitor-fetch";
import type { Step2ProbeSnapshot } from "./mainnet-monitor-types";

export async function runStep2HighFundingProbe(): Promise<Step2ProbeSnapshot> {
  const raw = (await postInfo({ type: "metaAndAssetCtxs" })) as [
    { universe?: Array<{ name?: string }> },
    Array<{
      funding?: string;
      midPx?: string;
      oraclePx?: string;
      markPx?: string;
      dayNtlVlm?: string;
    }>,
  ];
  const universe = raw[0]?.universe ?? [];
  const ctxs = raw[1] ?? [];

  type Cand = {
    symbol: string;
    fundingRateHourly: number;
    midPx: number;
    preferred: boolean;
  };
  const cands: Cand[] = [];
  universe.forEach((asset, index) => {
    const symbol = (asset.name ?? "").trim().toUpperCase();
    if (!symbol || symbol.includes(":")) return;
    const ctx = ctxs[index] ?? {};
    const midPx = parseFloat(ctx.midPx ?? ctx.oraclePx ?? ctx.markPx ?? "0");
    const fundingRateHourly = parseFloat(ctx.funding ?? "0") || 0;
    if (!(midPx > 0)) return;
    cands.push({
      symbol,
      fundingRateHourly,
      midPx,
      preferred: (PREFERRED as readonly string[]).includes(symbol),
    });
  });

  const preferred = cands.filter((c) => c.preferred);
  const pool = preferred.length > 0 ? preferred : cands;
  const funded = pool.filter(
    (c) => Math.abs(c.fundingRateHourly) >= FUNDING_ANOMALY_THRESHOLD,
  );
  const rank = (funded.length > 0 ? funded : pool).slice();
  rank.sort((a, b) => {
    const ai = (PREFERRED as readonly string[]).indexOf(a.symbol);
    const bi = (PREFERRED as readonly string[]).indexOf(b.symbol);
    const aOrd = ai >= 0 ? ai : 999;
    const bOrd = bi >= 0 ? bi : 999;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return Math.abs(b.fundingRateHourly) - Math.abs(a.fundingRateHourly);
  });
  const target = rank[0] ?? {
    symbol: "ETH",
    fundingRateHourly: 0,
    midPx: 0,
    preferred: true,
  };

  const t0 = Date.now();
  try {
    const book = (await postInfo(
      { type: "l2Book", coin: target.symbol },
      STALE_THRESHOLD_MS,
    )) as {
      levels?: [
        Array<{ px: string; sz: string }>,
        Array<{ px: string; sz: string }>,
      ];
    };
    const probeLatencyMs = Date.now() - t0;
    if (probeLatencyMs > STALE_THRESHOLD_MS) {
      return {
        symbol: target.symbol,
        fundingRateHourly: target.fundingRateHourly,
        midPx: target.midPx,
        probeLatencyMs,
        probeOk: false,
        depthUsd: 0,
        bidDepthUsd: 0,
        askDepthUsd: 0,
        reason: `L2_FAIL_CLOSED_${probeLatencyMs}ms`,
      };
    }
    const bids = book.levels?.[0] ?? [];
    const asks = book.levels?.[1] ?? [];
    const bidDepthUsd = sumDepthUsd(bids);
    const askDepthUsd = sumDepthUsd(asks);
    const bestBid = bids[0] ? parseFloat(bids[0].px) : 0;
    const bestAsk = asks[0] ? parseFloat(asks[0].px) : 0;
    const midPx =
      bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : target.midPx;
    return {
      symbol: target.symbol,
      fundingRateHourly: target.fundingRateHourly,
      midPx,
      probeLatencyMs,
      probeOk: true,
      depthUsd: Math.min(bidDepthUsd, askDepthUsd),
      bidDepthUsd,
      askDepthUsd,
    };
  } catch (err) {
    return {
      symbol: target.symbol,
      fundingRateHourly: target.fundingRateHourly,
      midPx: target.midPx,
      probeLatencyMs: Date.now() - t0,
      probeOk: false,
      depthUsd: 0,
      bidDepthUsd: 0,
      askDepthUsd: 0,
      reason: err instanceof Error ? err.message : "L2_FAIL_CLOSED",
    };
  }
}
