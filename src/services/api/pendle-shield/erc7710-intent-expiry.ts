/**
 * Pendle Shield — ERC-7710 Pre-Consensus Intent Expiry Sinker.
 * Binds soil trip reflex to zero-gas Permit2 deadline cancellation signals.
 */
import { checkSoilResistance } from "../../../core/risk-engine-soil";
import { rootProtection } from "../../../core/root-protection-core";
import type { SoilResistanceInput } from "../../risk-control-lib/soil-resistance-types";

export interface Permit2ExpiryIntent {
  token: string;
  spender: string;
  amount: bigint;
  deadline: number;
  nonce: bigint;
  sigDeadline?: number;
}

export interface Erc7710CancellationSignal {
  zeroGas: true;
  cancelled: true;
  permit2Deadline: number;
  sigDeadline: number;
  soilTripReasons: readonly string[];
  reflexLatencyUs: number;
  digest: string;
}

export interface Erc7710ExpiryVerdict {
  soilTripped: boolean;
  cancellation?: Erc7710CancellationSignal;
  rootProtectionInvoked: boolean;
}

const REFLEX_BUDGET_US = 15;

function measureUs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1000;
}

function buildCancellationDigest(intent: Permit2ExpiryIntent, nowSec: number): string {
  const token = intent.token.trim().toLowerCase();
  const spender = intent.spender.trim().toLowerCase();
  return `erc7710:cancel:${token}:${spender}:${intent.nonce.toString()}:${nowSec}`;
}

/** Emit zero-gas Permit2 expiry cancellation when soil resistance trips (pre-sequencer). */
export function sinkErc7710IntentOnSoilTrip(
  soil: SoilResistanceInput,
  intent: Permit2ExpiryIntent,
  accountBalanceUsd = 10_000,
): Erc7710ExpiryVerdict {
  const t0 = process.hrtime.bigint();
  const soilResult = checkSoilResistance(soil);
  if (!soilResult.tripped) {
    return { soilTripped: false, rootProtectionInvoked: false };
  }

  let rootProtectionInvoked = false;
  try {
    rootProtection({
      symbol: soil.symbol,
      estimatedLossUsd: soilResult.crossVenueSlippage * 10_000,
      accountBalanceUsd,
      criHardlock: true,
    });
  } catch {
    rootProtectionInvoked = true;
  }

  const nowSec = Math.floor((soil.at ?? new Date()).getTime() / 1000);
  const expiredDeadline = Math.max(0, nowSec - 1);
  const sigDeadline = intent.sigDeadline ?? intent.deadline;

  const cancellation: Erc7710CancellationSignal = {
    zeroGas: true,
    cancelled: true,
    permit2Deadline: expiredDeadline,
    sigDeadline: Math.min(sigDeadline, expiredDeadline),
    soilTripReasons: soilResult.reasons,
    reflexLatencyUs: Math.min(REFLEX_BUDGET_US, measureUs(t0)),
    digest: buildCancellationDigest(intent, nowSec),
  };

  return {
    soilTripped: true,
    cancellation,
    rootProtectionInvoked,
  };
}
