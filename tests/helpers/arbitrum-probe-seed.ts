import {
  __setSequencerProbeForTests,
  ARBITRUM_SEQUENCER_UPTIME_FEED,
  SEQUENCER_GRACE_SEC,
} from "../../src/services/risk/sequencer-guard";

export const EXPECTED_ARBITRUM_SEQUENCER_FEED = ARBITRUM_SEQUENCER_UPTIME_FEED;
import { __setSoftConfirmationProbeForTests } from "../../src/services/risk/soft-confirmation-guard";

/** Seed pass-through Arbitrum probe caches for tests that expect clear soil gates. */
export function seedSafeArbitrumProbes(nowMs: number = Date.now()): void {
  const nowSec = Math.floor(nowMs / 1000);
  __setSequencerProbeForTests({
    answer: 0,
    startedAtSec: nowSec - SEQUENCER_GRACE_SEC - 1,
    updatedAtSec: nowSec,
    fetchedAtMs: nowMs,
    safe: true,
    reason: null,
  });
  __setSoftConfirmationProbeForTests({
    l2LatestBlock: 1_000_020,
    l1FinalizedBatchBlock: 1_000_000,
    driftBlocks: 20,
    fetchedAtMs: nowMs,
    safe: true,
    reason: null,
  });
}
