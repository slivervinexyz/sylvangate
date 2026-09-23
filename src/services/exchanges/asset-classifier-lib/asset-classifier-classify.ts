/**
 * Hyperliquid asset classification — classify + infer helpers.
 */

import type { AssetClass, TradFiBucket } from "./asset-classifier-keywords";
import { placeTradFiAsset } from "./asset-classifier-placement";

export interface ClassifiedAsset {
  rawName: string;
  normalizedSymbol: string;
  assetClass: AssetClass;
  tradFiKey?: string;
}

/**
 * Classify HL universe / mid key names.
 * TradFi never enters crypto funding / Rule A paths.
 */
export function classifyHyperliquidAsset(rawName: string): ClassifiedAsset {
  const trimmed = rawName.trim();
  const placement = placeTradFiAsset(trimmed);

  if (placement) {
    return {
      rawName: trimmed,
      normalizedSymbol: trimmed,
      assetClass: placement.category,
      tradFiKey: placement.key,
    };
  }

  let body = trimmed;
  if (body.startsWith("@")) body = body.slice(1);

  return {
    rawName: trimmed,
    normalizedSymbol: body.toUpperCase(),
    assetClass: "crypto",
  };
}

export function isTradFiAsset(name: string): boolean {
  const c = classifyHyperliquidAsset(name);
  return c.assetClass !== "crypto";
}

/** Infer TradFi bucket — null only for plain crypto. */
export function inferTradFiCategory(rawName: string): TradFiBucket | null {
  return placeTradFiAsset(rawName)?.category ?? null;
}

/** @deprecated use isTradFiAsset */
export function isXyzAsset(name: string): boolean {
  return name.toUpperCase().includes("XYZ:") || isTradFiAsset(name);
}
