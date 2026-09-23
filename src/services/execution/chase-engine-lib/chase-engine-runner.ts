/**
 * Post-Only (ALO) Maker Chase Engine — chase loop runner.
 */

import type { Top3DepthProbeResult } from "../../hyperliquid/depth-probe";
import {
  CHASE_MAX_ATTEMPTS,
  CHASE_REPRICE_INTERVAL_MS,
  type ChaseOrderSpec,
  type MakerChaseDeps,
  type MakerChaseResult,
} from "./chase-engine-types";
import { planChaseTick, shouldUseMakerChase } from "./chase-engine-pricing";

/**
 * Run Post-Only maker chase — reprice every 100ms until filled or max attempts.
 */
export async function runMakerChaseUntilFilled(
  spec: ChaseOrderSpec,
  probe: Top3DepthProbeResult,
  deps: MakerChaseDeps,
): Promise<MakerChaseResult> {
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const interval = deps.repriceIntervalMs ?? CHASE_REPRICE_INTERVAL_MS;
  const maxAttempts = deps.maxAttempts ?? CHASE_MAX_ATTEMPTS;
  const ticks: MakerChaseResult["ticks"] = [];
  const reasons: string[] = [...probe.reasons];

  if (!shouldUseMakerChase(probe)) {
    return {
      route: "market_taker",
      filled: false,
      attempts: 0,
      finalLimitPx: null,
      ticks,
      probe,
      reasons: ["MAKER_CHASE_SKIP:TOP3_SUFFICIENT"],
    };
  }

  reasons.push("MAKER_CHASE:ALO_POST_ONLY");
  let previousPx = 0;
  let lastOid: number | undefined;
  let finalLimitPx: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const book = deps.getBook();
    const tick = planChaseTick(spec, book, attempt, previousPx);
    previousPx = tick.limitPx;
    finalLimitPx = tick.limitPx;

    if (lastOid !== undefined) {
      await deps.cancelOrder({ asset: spec.asset, oid: lastOid, cloid: spec.cloid });
      tick.cancelled = true;
    }

    const submitted = await deps.submitOrder(tick.wire, attempt);
    lastOid = submitted.oid;

    const filled = await deps.isFilled({ oid: submitted.oid, cloid: spec.cloid });
    tick.filled = filled;
    ticks.push(tick);

    if (filled) {
      reasons.push(`MAKER_CHASE_FILLED:attempt=${attempt}`);
      return {
        route: "alo_maker_chase",
        filled: true,
        attempts: attempt,
        finalLimitPx,
        ticks,
        probe,
        reasons,
      };
    }

    if (attempt < maxAttempts) {
      await sleep(interval);
    }
  }

  reasons.push(`MAKER_CHASE_TIMEOUT:attempts=${maxAttempts}`);
  return {
    route: "alo_maker_chase",
    filled: false,
    attempts: maxAttempts,
    finalLimitPx,
    ticks,
    probe,
    reasons,
  };
}
