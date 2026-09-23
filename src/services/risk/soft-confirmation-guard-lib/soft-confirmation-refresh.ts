import { fetchAllowlistedWithTimeout } from "../../defense/low-latency-fetch";
import { fetchArbBlockNumberByTag } from "../../adapters/arbitrum-rpc-fallback";
import { ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS } from "../../adapters/gmx-v2-rpc-constants";
import { fetchL1BlockNumberByTag } from "../../adapters/l1-rpc-fallback";
import { ARBITRUM_RPC_URL } from "../sequencer-guard";
import {
  SOFT_CONFIRMATION_CACHE_MAX_AGE_MS,
  SOFT_CONFIRMATION_PROBE_TTL_MS,
  SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS,
  evaluateSoftConfirmationDrift,
  getSoftConfirmationProbeCache,
  setSoftConfirmationProbeCache,
  type SoftConfirmationProbeState,
} from "./soft-confirmation-eval";

function hexBlockNum(hex: string | undefined): number {
  if (!hex) return 0;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

async function fetchArbBlockOrThrow(
  tag: "latest" | "finalized",
  fetchFn: typeof fetch | undefined,
): Promise<number> {
  const n = await fetchArbBlockNumberByTag(tag, { fetchFn });
  if (n === null) throw new Error("Soft confirmation RPC HTTP 429");
  return n;
}

async function fetchL1BlockOrThrow(
  tag: "latest" | "finalized",
  fetchFn: typeof fetch | undefined,
): Promise<number> {
  const n = await fetchL1BlockNumberByTag(tag, fetchFn);
  if (n === null) throw new Error("Soft confirmation L1 RPC HTTP 429");
  return n;
}

async function fetchBlockNumberByTag(
  rpcUrl: string,
  tag: "latest" | "finalized",
  fetchFn: typeof fetch | undefined,
  extraHosts?: readonly string[],
): Promise<number> {
  const body =
    tag === "latest"
      ? { jsonrpc: "2.0", id: tag, method: "eth_blockNumber", params: [] }
      : {
          jsonrpc: "2.0",
          id: tag,
          method: "eth_getBlockByNumber",
          params: [tag, false],
        };
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as RequestInit;
  const res = extraHosts
    ? fetchFn
      ? await fetchFn(rpcUrl, init)
      : await fetchAllowlistedWithTimeout(rpcUrl, init, extraHosts, ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS)
    : fetchFn
      ? await fetchFn(rpcUrl, init)
      : await fetchAllowlistedWithTimeout(rpcUrl, init, [], ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Soft confirmation RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string | { number?: string } };
  if (typeof json.result === "string") return hexBlockNum(json.result);
  return hexBlockNum((json.result as { number?: string } | undefined)?.number);
}

export async function refreshSoftConfirmationGuard(
  options: {
    fetchFn?: typeof fetch;
    arbitrumRpcUrl?: string;
    l1RpcUrl?: string;
    now?: () => number;
  } = {},
): Promise<SoftConfirmationProbeState> {
  const nowMs = options.now?.() ?? Date.now();
  const cached = getSoftConfirmationProbeCache();
  if (cached && nowMs - cached.fetchedAtMs < SOFT_CONFIRMATION_PROBE_TTL_MS) {
    return cached;
  }
  const arbRpc = options.arbitrumRpcUrl ?? ARBITRUM_RPC_URL;
  try {
    const [l2LatestBlock, l2FinalizedBlock, l1FinalizedBlock] = await Promise.all([
      options.arbitrumRpcUrl
        ? fetchBlockNumberByTag(arbRpc, "latest", options.fetchFn)
        : fetchArbBlockOrThrow("latest", options.fetchFn),
      options.arbitrumRpcUrl
        ? fetchBlockNumberByTag(arbRpc, "finalized", options.fetchFn)
        : fetchArbBlockOrThrow("finalized", options.fetchFn),
      fetchL1BlockOrThrow("finalized", options.fetchFn),
    ]);
    const l1FinalizedBatchBlock = l2FinalizedBlock > 0 ? l2FinalizedBlock : l1FinalizedBlock;
    const verdict = evaluateSoftConfirmationDrift(l2LatestBlock, l1FinalizedBatchBlock);
    const next: SoftConfirmationProbeState = {
      l2LatestBlock,
      l1FinalizedBatchBlock,
      driftBlocks: verdict.driftBlocks,
      fetchedAtMs: nowMs,
      safe: verdict.safe,
      reason: verdict.reason,
    };
    setSoftConfirmationProbeCache(next);
    return next;
  } catch (err) {
    if (cached && nowMs - cached.fetchedAtMs <= SOFT_CONFIRMATION_CACHE_MAX_AGE_MS) {
      return cached;
    }
    const fallback: SoftConfirmationProbeState = {
      l2LatestBlock: 0,
      l1FinalizedBatchBlock: 0,
      driftBlocks: SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS + 1,
      fetchedAtMs: nowMs,
      safe: false,
      reason: `SOFT_CONFIRMATION_RPC_FAIL:${err instanceof Error ? err.message : String(err)}`,
    };
    setSoftConfirmationProbeCache(fallback);
    return fallback;
  }
}
