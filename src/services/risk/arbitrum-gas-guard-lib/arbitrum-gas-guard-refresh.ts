import { postArbitrumJsonRpc } from "../../adapters/arbitrum-rpc-fallback";
import {
  ARB_GAS_INFO,
  ARBITRUM_ETH_USD_FEED,
  DEFAULT_TARGET_YIELD_USD,
  estimateL1SurchargeWei,
  evaluateGasSurcharge,
  evaluateOracleLag,
  GAS_GUARD_TTL_MS,
  getArbitrumGasGuardCache,
  setArbitrumGasGuardCache,
  type ArbitrumGasGuardState,
} from "./arbitrum-gas-guard-eval";

const GET_L1_BASE_FEE = "0xf5d6ded7";
const LATEST_ROUND_DATA = "0xfeaf968c";

const word = (hex: string, i: number) => {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  const s = i * 64;
  return raw.length >= s + 64 ? raw.slice(s, s + 64) : "0".repeat(64);
};

export async function refreshArbitrumGasGuard(options: {
  fetchFn?: typeof fetch; rpcUrl?: string; now?: () => number;
  targetYieldUsd?: number; calldataBytes?: number; blobBytes?: number;
} = {}): Promise<ArbitrumGasGuardState> {
  const nowMs = options.now?.() ?? Date.now();
  const cached = getArbitrumGasGuardCache();
  if (cached && nowMs - cached.fetchedAtMs < GAS_GUARD_TTL_MS) return cached;
  try {
    const rpcOpts = { fetchFn: options.fetchFn, preferredRpc: options.rpcUrl };
    const [l1Raw, oracleRaw, blockRaw] = await Promise.all([
      postArbitrumJsonRpc({
        jsonrpc: "2.0",
        id: "l1",
        method: "eth_call",
        params: [{ to: ARB_GAS_INFO, data: GET_L1_BASE_FEE }, "latest"],
      }, rpcOpts),
      postArbitrumJsonRpc({
        jsonrpc: "2.0",
        id: "oracle",
        method: "eth_call",
        params: [{ to: ARBITRUM_ETH_USD_FEED, data: LATEST_ROUND_DATA }, "latest"],
      }, rpcOpts),
      postArbitrumJsonRpc({
        jsonrpc: "2.0",
        id: "block",
        method: "eth_getBlockByNumber",
        params: ["latest", false],
      }, rpcOpts),
    ]);
    if (!l1Raw || !oracleRaw || !blockRaw) {
      throw new Error("Arbitrum gas guard RPC incomplete");
    }
    const l1Hex = String((l1Raw as { result?: string }).result ?? "0x");
    const oracleHex = String((oracleRaw as { result?: string }).result ?? "0x");
    const block = (blockRaw as { result?: { timestamp?: string } }).result;
    const l1BaseFeeWei = BigInt(`0x${word(l1Hex, 0)}`);
    const oracleUpdatedAtMs = Number(BigInt(`0x${word(oracleHex, 3)}`)) * 1000;
    const ethUsd = Number(BigInt(`0x${word(oracleHex, 1)}`)) / 1e8;
    const l2BlockTimestampMs = block?.timestamp
      ? Number.parseInt(block.timestamp, 16) * 1000
      : nowMs;
    const l1SurchargeWei = estimateL1SurchargeWei(l1BaseFeeWei, options.calldataBytes, options.blobBytes);
    const targetYieldUsd = options.targetYieldUsd ?? DEFAULT_TARGET_YIELD_USD;
    const l1SurchargeUsd = (Number(l1SurchargeWei) / 1e18) * (ethUsd > 0 ? ethUsd : 0);
    const gas = evaluateGasSurcharge(l1SurchargeUsd, targetYieldUsd);
    const lag = evaluateOracleLag(oracleUpdatedAtMs, l2BlockTimestampMs);
    const reasons = [gas.reason, lag.reason].filter(Boolean) as string[];
    const next: ArbitrumGasGuardState = {
      l1BaseFeeWei, l1SurchargeWei, l1SurchargeUsd, targetYieldUsd, gasYieldRatio: gas.ratio,
      gasBlocked: gas.blocked, oracleUpdatedAtMs, l2BlockTimestampMs, oracleLagMs: lag.lagMs,
      oracleLagDeadlock: lag.deadlock, reason: reasons.length ? reasons.join("|") : null, fetchedAtMs: nowMs,
    };
    setArbitrumGasGuardCache(next);
    return next;
  } catch (err) {
    if (cached) return cached;
    const targetYieldUsd = options.targetYieldUsd ?? DEFAULT_TARGET_YIELD_USD;
    const fallback: ArbitrumGasGuardState = {
      l1BaseFeeWei: 0n,
      l1SurchargeWei: 0n,
      l1SurchargeUsd: 0,
      targetYieldUsd,
      gasYieldRatio: 0,
      gasBlocked: true,
      oracleUpdatedAtMs: 0,
      l2BlockTimestampMs: 0,
      oracleLagMs: 0,
      oracleLagDeadlock: true,
      reason: `ARBITRUM_GAS_GUARD_RPC_FAIL:${err instanceof Error ? err.message : String(err)}`,
      fetchedAtMs: nowMs,
    };
    setArbitrumGasGuardCache(fallback);
    return fallback;
  }
}
