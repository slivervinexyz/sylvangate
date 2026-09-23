import type { HyperliquidMaps } from "./hl-types";
import { hyperliquidAdapter } from "./hl-adapter-class";

export async function fetchHyperliquidMaps(): Promise<HyperliquidMaps> {
  const bundle = await hyperliquidAdapter.fetchClassifiedBundle();
  return bundle.cryptoMaps;
}
