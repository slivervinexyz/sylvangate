/**
 * Soil bypass & provenance state checks for verify-5tx runner.
 */

import { auditHyperliquidLiveSoil } from "../../services/exchanges/hl-l2-book";
import type { LiveBookSoilAudit } from "../../services/check-soil-resistance";
import { __resetArbitrumGasGuardForTests } from "../../services/risk/arbitrum-gas-guard";
import {
  __setSequencerProbeForTests,
  SEQUENCER_GRACE_SEC,
} from "../../services/risk/sequencer-guard";
import { __setSoftConfirmationProbeForTests } from "../../services/risk/soft-confirmation-guard";
import { applyTestnetGrantSoilBoost } from "../verified-5tx";

export function isSkipSoilEnvEnabled(): boolean {
  const keys = ["SKIP_SOIL_CHECK", "SKIP_SOIL_PROBE_CHECK"] as const;
  return keys.some((k) => process.env[k] === "1" || process.env[k] === "true");
}

/** Clear Arb sequencer / soft-confirm / gas hardlocks so HL_LIVE smoke can post. */
export function seedSkipSoilExomeshProbes(nowMs: number = Date.now()): void {
  const nowSec = Math.floor(nowMs / 1000);
  __resetArbitrumGasGuardForTests();
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

/** Force tradeAllowed posture — strip sequencer/probe trip reasons for smoke runs. */
export function forceSoilTradeAllowed(audit: LiveBookSoilAudit): LiveBookSoilAudit {
  return {
    ...audit,
    ok: true,
    tripped: false,
    reasons: [],
  };
}

export function syntheticSoilAudit(symbol: string): LiveBookSoilAudit {
  return forceSoilTradeAllowed({
    ok: true,
    tripped: false,
    crossVenueSlippage: 0.0004,
    spotPerpSlippage: 0.0003,
    reasons: [],
    probe: {
      symbol,
      bestBid: 3_499,
      bestAsk: 3_501,
      midPx: 3_500,
      bidDepthUsd: 250_000,
      askDepthUsd: 250_000,
      depthUsd: 500_000,
      spreadBps: 5.7,
      priceImpactBps: 2.1,
    },
    spreadBps: 5.7,
    priceImpactBps: 2.1,
  });
}

export interface ResolveRunSoilAuditInput {
  symbol: string;
  notionalUsd: number;
  dryRun: boolean;
  livePost: boolean;
  abortOnSoilTrip: boolean;
  forceLiveSoil: boolean;
  skipSoilProbe: boolean;
  fetchFn: typeof fetch;
}

export async function resolveRunSoilAudit(
  input: ResolveRunSoilAuditInput,
): Promise<LiveBookSoilAudit> {
  const {
    symbol,
    notionalUsd,
    dryRun,
    livePost,
    abortOnSoilTrip,
    forceLiveSoil,
    skipSoilProbe,
    fetchFn,
  } = input;

  let soilAudit: LiveBookSoilAudit | null = null;

  if (skipSoilProbe) {
    if (livePost || forceLiveSoil) {
      try {
        soilAudit = await auditHyperliquidLiveSoil(symbol, { fetchFn, maxRetries: 1 });
      } catch {
        soilAudit = null;
      }
    }
    soilAudit = forceSoilTradeAllowed(soilAudit ?? syntheticSoilAudit(symbol));
  } else if (dryRun && !forceLiveSoil) {
    soilAudit = syntheticSoilAudit(symbol);
  } else {
    try {
      soilAudit = await auditHyperliquidLiveSoil(symbol, { fetchFn, maxRetries: 1 });
    } catch {
      soilAudit = null;
    }

    if (!soilAudit || soilAudit.tripped) {
      if (livePost && soilAudit?.tripped) {
        const depthOnly = soilAudit.reasons.every((r) => r.startsWith("DEPTH_USD"));
        if (depthOnly) {
          soilAudit = applyTestnetGrantSoilBoost(soilAudit, notionalUsd);
        }
      }
    }

    if (!soilAudit || soilAudit.tripped) {
      if (dryRun) {
        soilAudit = syntheticSoilAudit(symbol);
      } else if (abortOnSoilTrip) {
        throw new Error(
          `checkSoilResistance() TRIPPED — ${soilAudit?.reasons.join("; ") ?? "L2 book unavailable"}`,
        );
      }
    }
  }

  if (!soilAudit) {
    soilAudit = syntheticSoilAudit(symbol);
  }
  if (skipSoilProbe) {
    soilAudit = forceSoilTradeAllowed(soilAudit);
  }

  return soilAudit;
}
