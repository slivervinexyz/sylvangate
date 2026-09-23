/** GMX micro-fill market token registry + gmxinfra cross-check. */
import { getAddress, type Hex } from "viem";
import { GMX_MARKET_REGISTRY } from "../../config/gmx-markets";
import { GMX_MARKETS_INFO_URL } from "./gmx-micro-fill-constants";
import { BROWSER_MIMIC_USER_AGENT } from "../defense/rpc-whitelist";

const MICRO_FILL_MARKET_TOKENS = new Set(
  Object.values(GMX_MARKET_REGISTRY).map((e) => getAddress(e.marketToken)),
);

type GmxMarketsInfoRow = { marketToken: string; longToken: string; shortToken: string; name?: string };

export function normalizeMicroFillMarketToken(market: string): Hex {
  const normalized = getAddress(market as Hex);
  if (!MICRO_FILL_MARKET_TOKENS.has(normalized)) {
    throw new Error(
      `GMX_MARKET_INVALID: ${normalized} not in micro-fill registry (${[...MICRO_FILL_MARKET_TOKENS].join(", ")})`,
    );
  }
  return normalized;
}

export async function verifyMicroFillMarketAgainstGmxApi(market: string): Promise<Hex> {
  const normalized = normalizeMicroFillMarketToken(market);
  const entry = Object.values(GMX_MARKET_REGISTRY).find((e) => getAddress(e.marketToken) === normalized);
  if (!entry) return normalized;
  const res = await fetch(GMX_MARKETS_INFO_URL, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_MIMIC_USER_AGENT },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`GMX markets/info HTTP ${res.status}`);
  const body = (await res.json()) as { markets?: GmxMarketsInfoRow[] } | GmxMarketsInfoRow[];
  const rows = Array.isArray(body) ? body : (body.markets ?? []);
  const live = rows.find(
    (m) => getAddress(m.longToken as Hex) === getAddress(entry.longToken)
      && getAddress(m.shortToken as Hex) === getAddress(entry.shortToken),
  );
  if (!live) throw new Error(`GMX_MARKET_NOT_LISTED: ${entry.key} missing on gmxinfra markets/info`);
  const official = getAddress(live.marketToken as Hex);
  if (official !== normalized) {
    throw new Error(`GMX_MARKET_DRIFT: registry=${normalized} official=${official} for ${entry.key}`);
  }
  return official;
}
