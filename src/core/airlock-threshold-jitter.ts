/** Anti-gaming threshold jitter — soil slippage / min-depth lanes. */
import type { AirlockThresholdInput } from "./airlock-threshold-types";
import { resolveAirlockMinDepthUsd } from "./airlock-threshold-env";
import { MAX_SLIPPAGE } from "./airlock-threshold-math";

export const JITTER_MIN_BPS = 2;
export const JITTER_MAX_BPS = 5;

function isJitterEnabled(input: AirlockThresholdInput, forceEnable?: boolean): boolean {
  if (forceEnable) return true;
  if (input.disableThresholdJitter) return false;
  if (typeof process !== "undefined" && process.env?.VITEST === "true") return false;
  return true;
}

function sampleJitterBps(): { magnitudeBps: number; sign: 1 | -1 } {
  const buf = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
  else buf[0] = (Date.now() * 2654435761) >>> 0;
  const span = JITTER_MAX_BPS - JITTER_MIN_BPS + 1;
  const word = buf[0];
  return { magnitudeBps: JITTER_MIN_BPS + (word % span), sign: (word >>> 16) & 1 ? -1 : 1 };
}

export function resolveJitteredAirlockThresholds(
  input: AirlockThresholdInput,
  options?: { forceEnable?: boolean },
): { slippageFuse: number; minDepthUsd: number } {
  const baseSlippage = input.maxSlippage ?? MAX_SLIPPAGE;
  const baseMinDepth = resolveAirlockMinDepthUsd(input);
  if (!isJitterEnabled(input, options?.forceEnable)) return { slippageFuse: baseSlippage, minDepthUsd: baseMinDepth };
  const { magnitudeBps, sign } = sampleJitterBps();
  const deltaRatio = (sign * magnitudeBps) / 10_000;
  return {
    slippageFuse: Math.max(0, baseSlippage + deltaRatio),
    minDepthUsd: Math.max(0, Math.floor(baseMinDepth * (1 + deltaRatio))),
  };
}
