/** Pure soil slippage lane math — Wasm SSOT via `soil-wasm-runtime.ts`. */
import type { SoilResistanceInput } from "./soil-resistance-types";
import { MIN_DEPTH_USD, resolveSoilMinDepthUsd } from "./soil-resistance-env";
import {
  evaluatePackedSoilLane,
  evalAsyncVaultDriftViaWasm,
} from "./soil-wasm-runtime";
import {
  SOIL_IDX_DEPTH_USD,
  SOIL_IDX_DYDX_PERP,
  SOIL_IDX_HL_PERP,
  SOIL_IDX_HL_SPOT,
  SOIL_IDX_MIN_DEPTH_USD,
  SOIL_IDX_SLIPPAGE_FUSE,
  SOIL_PACK_LEN,
  evaluateSoilSlippagePackedColdPath,
} from "./soil-slippage-cold-path";

export { MIN_DEPTH_USD };
export {
  SOIL_REASON_INSUFFICIENT_DEPTH,
  SOIL_REASON_CROSS_VENUE,
  SOIL_REASON_DEPTH_USD,
} from "./soil-slippage-cold-path";
export const MAX_SLIPPAGE = 0.005;
export const VINE_SOIL_MAX_SLIPPAGE = 0.003;

const SOIL_LANE_SCRATCH = new Float64Array(SOIL_PACK_LEN);

export function packSoilLane(
  hlSpot: number,
  hlPerp: number,
  dydxPerp: number,
  depthUsd: number,
  slippageFuse: number,
  minDepthUsd: number,
  out?: Float64Array,
): Float64Array {
  const lane = out ?? new Float64Array(SOIL_PACK_LEN);
  lane[SOIL_IDX_HL_SPOT] = hlSpot;
  lane[SOIL_IDX_HL_PERP] = hlPerp;
  lane[SOIL_IDX_DYDX_PERP] = dydxPerp;
  lane[SOIL_IDX_DEPTH_USD] = depthUsd;
  lane[SOIL_IDX_SLIPPAGE_FUSE] = slippageFuse;
  lane[SOIL_IDX_MIN_DEPTH_USD] = minDepthUsd;
  return lane;
}

/** @parity-only — cold-path mirror; hot path uses `evaluatePackedSoilLane` / Wasm. */
export const evaluateSoilSlippagePacked = evaluateSoilSlippagePackedColdPath;

export interface SoilSlippageOverrides {
  maxSlippage?: number;
  minDepthUsd?: number;
}

export function computeSoilSlippageMetrics(
  input: SoilResistanceInput,
  overrides?: SoilSlippageOverrides,
): { crossVenueSlippage: number; spotPerpSlippage: number; tripFlags: number } {
  const slippageFuse = overrides?.maxSlippage ?? input.maxSlippage ?? MAX_SLIPPAGE;
  const minDepthUsd = overrides?.minDepthUsd ?? resolveSoilMinDepthUsd(input);
  SOIL_LANE_SCRATCH.fill(0);
  packSoilLane(
    input.hlSpot,
    input.hlPerp,
    input.dydxPerp,
    input.depthUsd ?? Number.NaN,
    slippageFuse,
    minDepthUsd,
    SOIL_LANE_SCRATCH,
  );
  return evaluatePackedSoilLane(SOIL_LANE_SCRATCH);
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
