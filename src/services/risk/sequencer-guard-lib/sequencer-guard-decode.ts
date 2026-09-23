/**
 * Arbitrum Sequencer Uptime — Chainlink feed decode + grace evaluation.
 */

import { SEQUENCER_GRACE_SEC } from "./sequencer-guard-types";

export function decodeLatestRoundData(hex: string): {
  answer: number;
  startedAtSec: number;
  updatedAtSec: number;
} {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (raw.length < 256) {
    return { answer: 1, startedAtSec: 0, updatedAtSec: 0 };
  }
  const answer = Number(BigInt(`0x${raw.slice(64, 128)}`));
  const startedAtSec = Number(BigInt(`0x${raw.slice(128, 192)}`));
  const updatedAtSec = Number(BigInt(`0x${raw.slice(192, 256)}`));
  return { answer, startedAtSec, updatedAtSec };
}

export function evaluateSequencerProbe(
  answer: number,
  startedAtSec: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): { safe: boolean; reason: string | null } {
  if (answer !== 0) {
    return { safe: false, reason: "ARBITRUM_SEQUENCER_DOWN" };
  }
  const elapsed = nowSec - startedAtSec;
  if (startedAtSec > 0 && elapsed < SEQUENCER_GRACE_SEC) {
    return {
      safe: false,
      reason: `ARBITRUM_SEQUENCER_GRACE:${elapsed}s<${SEQUENCER_GRACE_SEC}s`,
    };
  }
  return { safe: true, reason: null };
}
