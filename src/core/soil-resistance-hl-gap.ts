/** HL HIP-3 orderbook gap guard — pure leverage / depth scaling. */
import { logSoilCore } from "./core-telemetry";
export interface HlOrderbookGapGuardPureInput {
  isHip3Symbol: boolean;
  inGapWindow: boolean;
  depthUsd?: number;
  minDepthUsd: number;
  requestedLeverage?: number;
}

export interface HlOrderbookGapGuardPureResult {
  triggered: boolean;
  targetLeverage: number;
  requiredMinDepthUsd: number;
  reasons: string[];
}

export function evaluateHlOrderbookGapGuardPure(
  input: HlOrderbookGapGuardPureInput,
  opts: { guardLabel: string; normalLeverage: number; floorLeverage: number; depthMultiplier: number },
): HlOrderbookGapGuardPureResult {
  const baseMinDepth = Math.max(0, input.minDepthUsd);
  const reasons: string[] = [];
  if (!input.isHip3Symbol || !input.inGapWindow) {
    return {
      triggered: false,
      targetLeverage: input.requestedLeverage ?? opts.normalLeverage,
      requiredMinDepthUsd: baseMinDepth,
      reasons,
    };
  }
  const targetLeverage = opts.floorLeverage;
  const requiredMinDepthUsd = Math.round(baseMinDepth * opts.depthMultiplier);
  reasons.push(opts.guardLabel);
  reasons.push(`HL_ORDERBOOK_LEVERAGE_SCALE=${opts.normalLeverage}x->${targetLeverage}x`);
  if (
    input.requestedLeverage !== undefined &&
    Number.isFinite(input.requestedLeverage) &&
    input.requestedLeverage > targetLeverage + 1e-6
  ) {
    reasons.push(`HL_ORDERBOOK_LEVERAGE_CAP=${targetLeverage}<${input.requestedLeverage.toFixed(2)}`);
  }
  if (input.depthUsd !== undefined && input.depthUsd < requiredMinDepthUsd) {
    reasons.push(`HL_ORDERBOOK_GAP_GUARD_DEPTH=${input.depthUsd}<${requiredMinDepthUsd}`);
  }
  logSoilCore("HL orderbook gap guard", { triggered: true, targetLeverage, requiredMinDepthUsd });
  return { triggered: true, targetLeverage, requiredMinDepthUsd, reasons };
}
