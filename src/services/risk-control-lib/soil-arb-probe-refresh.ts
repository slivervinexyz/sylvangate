import type { SoilResistanceInput, SoilResistanceResult } from "./soil-resistance";
import { checkSoilResistance } from "./soil-resistance";
import { refreshArbitrumGasGuard } from "../risk/arbitrum-gas-guard";
import {
  getSequencerUnsafeReason,
  isSequencerSafe,
  refreshSequencerGuard,
} from "../risk/sequencer-guard";
import {
  getSoftConfirmationUnsafeReason,
  isSoftConfirmationSafe,
  refreshSoftConfirmationGuard,
} from "../risk/soft-confirmation-guard";

const RPC_ROTATE_RE = /429|503|RPC_FAIL|NETWORK_BUFFERED|HTTP_429|HTTP_503/i;

function isRpcRotateReason(reason: string | null | undefined): boolean {
  return !!reason && RPC_ROTATE_RE.test(reason);
}

async function refreshArbGuardBundle(): Promise<void> {
  await Promise.all([
    refreshSequencerGuard(),
    refreshSoftConfirmationGuard(),
    refreshArbitrumGasGuard().catch(() => undefined),
  ]);
}

/** Retry guard refresh once when prior probe failed on 429/503 failover class. */
export async function refreshSoilArbitrumProbesWithFallback(): Promise<{
  sequencerOk: boolean;
  softOk: boolean;
  reasons: string[];
}> {
  await refreshArbGuardBundle();
  let seqOk = isSequencerSafe();
  let softOk = isSoftConfirmationSafe();
  const reasons: string[] = [];
  if (!seqOk) reasons.push(getSequencerUnsafeReason() ?? "ARBITRUM_SEQUENCER_UNSAFE");
  if (!softOk) reasons.push(getSoftConfirmationUnsafeReason() ?? "SOFT_CONFIRMATION_UNSAFE");

  const needsRetry =
    (!seqOk && isRpcRotateReason(getSequencerUnsafeReason())) ||
    (!softOk && isRpcRotateReason(getSoftConfirmationUnsafeReason()));
  if (needsRetry) {
    await refreshArbGuardBundle();
    seqOk = isSequencerSafe();
    softOk = isSoftConfirmationSafe();
    reasons.length = 0;
    if (!seqOk) reasons.push(getSequencerUnsafeReason() ?? "ARBITRUM_SEQUENCER_UNSAFE");
    if (!softOk) reasons.push(getSoftConfirmationUnsafeReason() ?? "SOFT_CONFIRMATION_UNSAFE");
  }

  return { sequencerOk: seqOk, softOk, reasons };
}

/** Async soil gate — refresh Arbitrum probes with 429/503 failover before sync check. */
export async function checkSoilResistanceWithArbFallback(
  input: SoilResistanceInput,
): Promise<SoilResistanceResult> {
  await refreshSoilArbitrumProbesWithFallback();
  return checkSoilResistance(input);
}
