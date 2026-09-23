/** Hyperliquid wallet balance telemetry — spot USDC/HYPE + perps margin. */
import { HL_INFO_URL } from "../config/constants";
import { fetchAllowlistedWithTimeout } from "./defense/low-latency-fetch";

export interface HlWalletTelemetrySnapshot {
  address: string;
  spotUsdcUsd: number;
  spotHypeQty: number;
  spotHypeUsd: number;
  perpsMarginUsd: number;
  totalUsd: number;
  fetchedAt: string;
}

const cache = new Map<string, HlWalletTelemetrySnapshot>();

async function postInfo(
  body: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<unknown> {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as RequestInit;
  const res = fetchFn
    ? await fetchFn(HL_INFO_URL, init)
    : await fetchAllowlistedWithTimeout(HL_INFO_URL, init, ["api.hyperliquid.xyz"]);
  if (!res.ok) throw new Error(`HL info HTTP ${res.status}`);
  return res.json();
}

async function fetchHypeMidUsd(fetchFn: typeof fetch): Promise<number> {
  const raw = (await postInfo({ type: "allMids" }, fetchFn)) as Record<string, string>;
  const px = parseFloat(raw.HYPE ?? "0");
  return Number.isFinite(px) && px > 0 ? px : 0;
}

/** Live HL unified balance for grant-audit dual-wallet TVL. */
export async function fetchHlWalletTelemetry(
  userAddress: string,
  fetchFn: typeof fetch = fetch,
): Promise<HlWalletTelemetrySnapshot> {
  const user = userAddress.trim();
  let spotUsdcUsd = 0;
  let spotHypeQty = 0;
  let perpsMarginUsd = 0;

  const spot = (await postInfo({ type: "spotClearinghouseState", user }, fetchFn)) as {
    balances?: Array<{ coin?: string; total?: string }>;
  };
  for (const bal of spot.balances ?? []) {
    const coin = (bal.coin ?? "").toUpperCase();
    const total = parseFloat(bal.total ?? "0") || 0;
    if (coin === "USDC" || coin === "USDT") spotUsdcUsd += total;
    if (coin === "HYPE") spotHypeQty += total;
  }

  const ch = (await postInfo({ type: "clearinghouseState", user }, fetchFn)) as {
    marginSummary?: { accountValue?: string };
  };
  perpsMarginUsd = parseFloat(ch.marginSummary?.accountValue ?? "0") || 0;

  const hypeMid = spotHypeQty > 0 ? await fetchHypeMidUsd(fetchFn) : 0;
  const spotHypeUsd = spotHypeQty * hypeMid;
  const totalUsd = spotUsdcUsd + spotHypeUsd + perpsMarginUsd;
  const snap: HlWalletTelemetrySnapshot = {
    address: user,
    spotUsdcUsd,
    spotHypeQty,
    spotHypeUsd,
    perpsMarginUsd,
    totalUsd,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(user.toLowerCase(), snap);
  return snap;
}

export function getHlWalletTelemetryCache(address: string): HlWalletTelemetrySnapshot | null {
  return cache.get(address.trim().toLowerCase()) ?? null;
}

export function __setHlWalletTelemetryCacheForTests(
  address: string,
  snap: HlWalletTelemetrySnapshot | null,
): void {
  const key = address.trim().toLowerCase();
  if (snap) cache.set(key, snap);
  else cache.delete(key);
}

export function __resetHlWalletTelemetryCacheForTests(): void {
  cache.clear();
}
