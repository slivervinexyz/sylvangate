/**
 * Arbitrum Sequencer Uptime — Chainlink feed refresh (Workers-safe eth_call).
 */

import { fetchArbitrumRpc } from "../../adapters/arbitrum-rpc-fallback";
import { GMX_RPC_EXTRA_HOSTS } from "../../adapters/gmx-v2-rpc-constants";
import {
  ARBITRUM_SEQUENCER_UPTIME_FEED,
  SEQUENCER_PROBE_TTL_MS,
  type SequencerProbeState,
} from "./sequencer-guard-types";
import { decodeLatestRoundData, evaluateSequencerProbe } from "./sequencer-guard-decode";
import { getSequencerProbeCache, setSequencerProbeCache } from "./sequencer-guard-cache";

const LATEST_ROUND_DATA_SELECTOR = "0xfeaf968c";

export async function refreshSequencerGuard(options: {
  fetchFn?: typeof fetch;
  rpcUrl?: string;
  now?: () => number;
} = {}): Promise<SequencerProbeState> {
  const nowMs = options.now?.() ?? Date.now();
  const probeCache = getSequencerProbeCache();
  if (probeCache && nowMs - probeCache.fetchedAtMs < SEQUENCER_PROBE_TTL_MS) {
    return probeCache;
  }
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        { to: ARBITRUM_SEQUENCER_UPTIME_FEED, data: LATEST_ROUND_DATA_SELECTOR },
        "latest",
      ],
    }),
  } as RequestInit;
  try {
    const res = await fetchArbitrumRpc(init, {
      fetchFn: options.fetchFn,
      preferredRpc: options.rpcUrl,
      extraHosts: [...GMX_RPC_EXTRA_HOSTS],
    });
    if (!res) {
      if (probeCache) return probeCache;
      const failed: SequencerProbeState = {
        answer: 1,
        startedAtSec: 0,
        updatedAtSec: 0,
        fetchedAtMs: nowMs,
        safe: false,
        reason: "ARBITRUM_SEQUENCER_RPC_FAIL:ALL_PROVIDERS_EXHAUSTED",
      };
      setSequencerProbeCache(failed);
      return failed;
    }
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (json.error) {
      const failed: SequencerProbeState = {
        answer: 1,
        startedAtSec: 0,
        updatedAtSec: 0,
        fetchedAtMs: nowMs,
        safe: false,
        reason: `ARBITRUM_SEQUENCER_RPC_FAIL:${json.error.message ?? "RPC_ERROR"}`,
      };
      setSequencerProbeCache(failed);
      return failed;
    }
    const decoded = decodeLatestRoundData(json.result ?? "0x");
    const verdict = evaluateSequencerProbe(
      decoded.answer,
      decoded.startedAtSec,
      Math.floor(nowMs / 1000),
    );
    const next: SequencerProbeState = {
      answer: decoded.answer,
      startedAtSec: decoded.startedAtSec,
      updatedAtSec: decoded.updatedAtSec,
      fetchedAtMs: nowMs,
      safe: verdict.safe,
      reason: verdict.reason,
    };
    setSequencerProbeCache(next);
    return next;
  } catch (err) {
    if (probeCache) return probeCache;
    const failed: SequencerProbeState = {
      answer: 1,
      startedAtSec: 0,
      updatedAtSec: 0,
      fetchedAtMs: nowMs,
      safe: false,
      reason: `ARBITRUM_SEQUENCER_RPC_FAIL:${err instanceof Error ? err.message : String(err)}`,
    };
    setSequencerProbeCache(failed);
    return failed;
  }
}
