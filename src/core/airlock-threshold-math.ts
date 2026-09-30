/** Pure soil slippage lane math — Wasm SSOT via `airlock-wasm-runtime.ts`. */
import type { AirlockThresholdInput } from "./airlock-threshold-types";
import { MIN_DEPTH_USD, resolveAirlockMinDepthUsd } from "./airlock-threshold-env";
import {
  evaluatePackedAirlockLane,
  evalAsyncVaultDriftViaWasm,
} from "./airlock-wasm-runtime";
import {
  AIRLOCK_IDX_DEPTH_USD,
  AIRLOCK_IDX_DYDX_PERP,
  AIRLOCK_IDX_HL_PERP,
  AIRLOCK_IDX_HL_SPOT,
  AIRLOCK_IDX_MIN_DEPTH_USD,
  AIRLOCK_IDX_SLIPPAGE_FUSE,
  AIRLOCK_PACK_LEN,
  evaluateAirlockSlippagePackedColdPath,
} from "./airlock-slippage-cold-path";

export { MIN_DEPTH_USD };
export {
  AIRLOCK_REASON_INSUFFICIENT_DEPTH,
  AIRLOCK_REASON_CROSS_VENUE,
  AIRLOCK_REASON_DEPTH_USD,
} from "./airlock-slippage-cold-path";
export const MAX_SLIPPAGE = 0.005;
export const VINE_AIRLOCK_MAX_SLIPPAGE = 0.003;

const AIRLOCK_LANE_SCRATCH = new Float64Array(AIRLOCK_PACK_LEN);

export function packAirlockLane(
  hlSpot: number,
  hlPerp: number,
  dydxPerp: number,
  depthUsd: number,
  slippageFuse: number,
  minDepthUsd: number,
  out?: Float64Array,
): Float64Array {
  const lane = out ?? new Float64Array(AIRLOCK_PACK_LEN);
  lane[AIRLOCK_IDX_HL_SPOT] = hlSpot;
  lane[AIRLOCK_IDX_HL_PERP] = hlPerp;
  lane[AIRLOCK_IDX_DYDX_PERP] = dydxPerp;
  lane[AIRLOCK_IDX_DEPTH_USD] = depthUsd;
  lane[AIRLOCK_IDX_SLIPPAGE_FUSE] = slippageFuse;
  lane[AIRLOCK_IDX_MIN_DEPTH_USD] = minDepthUsd;
  return lane;
}

/** @parity-only — cold-path mirror; hot path uses `evaluatePackedAirlockLane` / Wasm. */
export const evaluateAirlockSlippagePacked = evaluateAirlockSlippagePackedColdPath;

export interface AirlockSlippageOverrides {
  maxSlippage?: number;
  minDepthUsd?: number;
}

export function computeAirlockSlippageMetrics(
  input: AirlockThresholdInput,
  overrides?: AirlockSlippageOverrides,
): { crossVenueSlippage: number; spotPerpSlippage: number; tripFlags: number } {
  const slippageFuse = overrides?.maxSlippage ?? input.maxSlippage ?? MAX_SLIPPAGE;
  const minDepthUsd = overrides?.minDepthUsd ?? resolveAirlockMinDepthUsd(input);
  AIRLOCK_LANE_SCRATCH.fill(0);
  packAirlockLane(
    input.hlSpot,
    input.hlPerp,
    input.dydxPerp,
    input.depthUsd ?? Number.NaN,
    slippageFuse,
    minDepthUsd,
    AIRLOCK_LANE_SCRATCH,
  );
  return evaluatePackedAirlockLane(AIRLOCK_LANE_SCRATCH);
}

const ASYNC_VAULT_BPS = 10_000n;
const U64_MAX = 0xffff_ffff_ffff_ffffn;

function evalAsyncVaultDriftColdPath(requestRate: bigint, claimRate: bigint, maxBps: number): boolean {
  if (requestRate <= 0n || !Number.isFinite(maxBps) || maxBps < 0) return true;
  const delta = claimRate > requestRate ? claimRate - requestRate : requestRate - claimRate;
  return delta * ASYNC_VAULT_BPS > BigInt(maxBps | 0) * requestRate;
}

/** ERC-7540 async vault drift — Wasm SSOT (`eval_async_vault_drift` in `soil_core.wasm`). */
export function evalAsyncVaultDrift(requestRate: bigint, claimRate: bigint, maxBps: number): boolean {
  if (requestRate <= 0n || !Number.isFinite(maxBps) || maxBps < 0) return true;
  if (requestRate <= U64_MAX && claimRate <= U64_MAX) {
    const wasm = evalAsyncVaultDriftViaWasm(requestRate, claimRate, maxBps);
    if (wasm !== null) return wasm;
  }
  return evalAsyncVaultDriftColdPath(requestRate, claimRate, maxBps);
}

export function evalAsyncVaultDriftBps(requestRate: bigint, claimRate: bigint): number {
  if (requestRate <= 0n) return Number.POSITIVE_INFINITY;
  const delta = claimRate > requestRate ? claimRate - requestRate : requestRate - claimRate;
  return Number((delta * ASYNC_VAULT_BPS) / requestRate);
}
