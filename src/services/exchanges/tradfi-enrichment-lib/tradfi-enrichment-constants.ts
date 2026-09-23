import type { TradFiBucket } from "../asset-classifier";
import type { TradFiCategoryKey } from "./tradfi-enrichment-types";

export const CATEGORY_BUCKET: Record<TradFiBucket, TradFiCategoryKey> = {
  commodity: "commodities",
  stock: "stocks",
  index: "indices",
  fx: "fx",
  preipo: "preipo",
};

export const DISPLAY_NAMES: Record<string, string> = {
  brent: "BRENT",
  wti: "WTI",
  gold: "GOLD",
  silver: "SILVER",
  copper: "COPPER",
  natgas: "NATGAS",
  platinum: "PLATINUM",
  palladium: "PALLADIUM",
  aluminium: "ALUMINIUM",
  urnm: "URNM",
  nvda: "NVDA",
  samsung: "SAMSUNG",
  smsn: "SMSN",
  googl: "GOOGL",
  goog: "GOOG",
  msft: "MSFT",
  intc: "INTC",
  crcl: "CRCL",
  aapl: "AAPL",
  tsla: "TSLA",
  meta: "META",
  amzn: "AMZN",
  tsmc: "TSMC",
  tsm: "TSM",
  mu: "MU",
  skhynix: "SKHYNIX",
  dram: "DRAM",
  sndk: "SNDK",
  amd: "AMD",
  xyz100: "XYZ100",
  sp500: "SP500",
  us500: "US500",
  jp225: "JP225",
  kr200: "KR200",
  qqq: "QQQ",
  usdjpy: "USDJPY",
  eurusd: "EURUSD",
  gbpusd: "GBPUSD",
  usdkrw: "USDKRW",
  dxy: "DXY",
  cxmt: "CXMT",
  qnt: "QNT",
};

export function displayNameForKey(key: string): string {
  return DISPLAY_NAMES[key.toLowerCase()] ?? key.toUpperCase();
}
