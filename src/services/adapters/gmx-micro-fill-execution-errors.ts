/** GMX micro-fill — execution errors barrel (split sub-modules <200 LOC each). */
import type { Hex, PublicClient } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { isSilentGmxSimulateRevert, simulateGmxMicroFillOrder } from "./gmx-micro-fill-router-encode";
import { decodeGmxFailedTransaction } from "./gmx-micro-fill-execution-errors-replay";
import { formatGmxMicroFillErrorSummary, printGmxMicroFillError, contextFromPayload } from "./gmx-micro-fill-execution-errors-summary";
import {
  GmxMicroFillExecutionError,
  type GmxFailedTxDiagnostics,
  type GmxMicroFillExecutionContext,
} from "./gmx-micro-fill-execution-errors.types";

export type { GmxFailedTxDiagnostics, GmxMicroFillExecutionContext };
export { GmxMicroFillExecutionError, decodeGmxFailedTransaction, formatGmxMicroFillErrorSummary, printGmxMicroFillError, contextFromPayload };

export function isBypassSimulationEnabled(): boolean {
  const v = (process.env.BYPASS_SIMULATION ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function runGmxMicroFillSimulationPreflight(input: {
  client: Pick<PublicClient, "simulateContract">;
  payload: GmxV2UnsignedOrderPayload;
  from: Hex;
}): Promise<{ bypassed: boolean }> {
  const ctx = contextFromPayload(input.payload, input.from, "ExchangeRouter.multicall simulateContract");
  try {
    await simulateGmxMicroFillOrder(input);
    return { bypassed: false };
  } catch (err) {
    if (isSilentGmxSimulateRevert(err) && isBypassSimulationEnabled()) {
      console.warn("[gmx-micro-fill] BYPASS_SIMULATION=true — skipping eth_call preflight, proceeding to broadcast");
      return { bypassed: true };
    }
    throw new GmxMicroFillExecutionError(err, ctx, formatGmxMicroFillErrorSummary(err, ctx));
  }
}
