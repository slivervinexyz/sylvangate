import type {
  ExchangePriceMaps,
  MatrixSuccessResponse,
  PythonGatewayPayload,
} from "../types/matrix";
import { assembleMatrix } from "./assemble-matrix";
import { hktTimestamp } from "./config";
import { EXTERNAL_FETCH_TIMEOUT_MS, fetchAllowlistedWithTimeout } from "./defense/low-latency-fetch";

function sanitizePerpMap(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value <= 0) continue;
    out[key.toUpperCase()] = value;
  }
  return out;
}

export async function processPythonGatewayData(
  rawJson: PythonGatewayPayload,
): Promise<MatrixSuccessResponse> {
  const hkt = hktTimestamp();
  const items = rawJson.raw?.matrix ?? {};

  const maps: ExchangePriceMaps = {
    hlSpot: {},
    hlPerp: {},
    dydxPerp: {},
    hlFunding: {},
  };

  for (const item of Object.values(items)) {
    const symbol = item.pair.toUpperCase();
    if (item.exchange === "Hyperliquid" || item.exchange === "HL") {
      maps.hlSpot[symbol] = item.price;
      maps.hlPerp[symbol] = item.price;
      maps.hlFunding[symbol] = item.funding;
    }
  }

  maps.dydxPerp = sanitizePerpMap(maps.hlPerp);

  const base = assembleMatrix(hkt, maps);
  base.debug_raw_keys = {
    hlSpot: Object.keys(maps.hlSpot),
    hlPerp: Object.keys(maps.hlPerp),
  };
  return base;
}

export async function fetchPythonGateway(
  gatewayUrl: string,
): Promise<PythonGatewayPayload> {
  try {
    const response = await fetchAllowlistedWithTimeout(
      gatewayUrl,
      { headers: { "User-Agent": "Mozilla/5.0" } },
      [],
      EXTERNAL_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Gateway HTTP ${response.status}`);
    }

    return (await response.json()) as PythonGatewayPayload;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[GATEWAY] Network connection lost — gateway fetch failed: ${message}`,
    );
    throw err instanceof Error ? err : new Error(message);
  }
}
