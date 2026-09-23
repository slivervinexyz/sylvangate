import { HUD_CANARY_EXPECTED } from "../../src/services/defense/ui-canary";

export const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

export const BASE_ORDER = {
  asset: 0,
  isBuy: true,
  limitPx: "50000",
  sz: "0.01",
  reduceOnly: false,
  orderType: { limit: { tif: "Gtc" as const } },
};

export function hudRequest(canary = HUD_CANARY_EXPECTED): Request {
  return new Request("https://bedeltawater.slivervine.xyz/api/hud-stream", {
    headers: { "X-Santenmoku-Canary": canary },
  });
}
