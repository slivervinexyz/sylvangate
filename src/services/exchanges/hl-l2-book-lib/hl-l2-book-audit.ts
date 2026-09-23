import {
  auditLiveBookSoilResistance,
  buildFailClosedSoilAudit,
  type LiveBookSoilAudit,
  type LiveBookSoilProbe,
} from "../../check-soil-resistance";
import { HL_TESTNET_MIN_DEPTH_USD } from "../../risk-control";
import { computeLiveBookMetrics } from "./hl-l2-book-metrics";
import { fetchLiveL2Book } from "./hl-l2-book-fetch";
import { isL2BookFailClosed, type FetchLiveL2BookOptions } from "./hl-l2-book-types";

/** Fetch live testnet L2 book and run checkSoilResistance() depth audit. */
export async function auditHyperliquidLiveSoil(
  coin: string,
  options: FetchLiveL2BookOptions & { probeUsd?: number } = {},
): Promise<LiveBookSoilAudit | null> {
  const snapshot = await fetchLiveL2Book(coin, options);
  const nowMs = options.nowMs ?? Date.now();

  if (isL2BookFailClosed(snapshot, nowMs)) {
    return buildFailClosedSoilAudit(snapshot.coin);
  }

  const metrics = computeLiveBookMetrics(snapshot.book, options.probeUsd);
  if (!metrics) {
    return buildFailClosedSoilAudit(snapshot.coin);
  }

  const probe: LiveBookSoilProbe = {
    symbol: snapshot.coin,
    ...metrics,
  };

  return auditLiveBookSoilResistance(probe, undefined, {
    minDepthUsd: HL_TESTNET_MIN_DEPTH_USD,
  });
}
