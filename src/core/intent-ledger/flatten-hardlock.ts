/**
 * Compensating flatten escalation — R20 hardlock on flatten failure (grant documentation SSOT).
 */

import { severCircuitBreakerPipeline } from "../../services/root-protection-lib/circuit-breaker-sever";
import { saveSystemStateToKV } from "../../services/kv-lib/system-state";
import type { SliverVineKv } from "../../services/kv-lib/keys";
import { appendStateTransactionLog } from "../../services/state/system-state";
import { readActiveSystemState } from "../state";
import type { CrossLegIntent, FlattenLegFn } from "./types";

export const R20_FLATTEN_FAILED = "R20_FLATTEN_FAILED" as const;

let hardlockKvBinding: SliverVineKv | undefined;

/** Wire Worker KV for synchronous hardlock persistence after flatten failure. */
export function configureFlattenHardlockKv(kv: SliverVineKv | undefined): void {
  hardlockKvBinding = kv;
}

/** @internal test reset */
export function __resetFlattenHardlockKvForTests(): void {
  hardlockKvBinding = undefined;
}

async function persistHardlockSystemState(): Promise<void> {
  await saveSystemStateToKV(hardlockKvBinding, readActiveSystemState());
}

/**
 * Best-effort flatten all legs; on any failure sever R20 once and persist hardlock.
 */
export async function runCompensatingFlattenWithHardlock(
  intent: CrossLegIntent,
  flattenLeg: FlattenLegFn,
): Promise<CrossLegIntent> {
  const failureDetails: string[] = [];

  for (const action of intent.flattenActions) {
    const result = await flattenLeg(action, intent);
    if (!result.ok) {
      failureDetails.push(result.reason ?? "COMPENSATING_FLATTEN_FAILED");
    }
  }

  if (failureDetails.length > 0) {
    severCircuitBreakerPipeline("R20");
    appendStateTransactionLog(R20_FLATTEN_FAILED, failureDetails.join("|"));
    intent.hardlocked = true;
    const flattenSuffix = `${R20_FLATTEN_FAILED}:${failureDetails.join("|")}`;
    intent.abortReason = intent.abortReason
      ? `${intent.abortReason}|${flattenSuffix}`
      : flattenSuffix;
    await persistHardlockSystemState();
  }

  return intent;
}
