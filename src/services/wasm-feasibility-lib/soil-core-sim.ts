/**
 * M4 Wasm feasibility — pure no-std soil core math (portable to Rust `#![no_std]`).
 * SSOT layout: `src/core/wasm-soil-ffi.ts` · `PROTO_VECT_LEN` protocol lanes.
 */
import { PROTO_VECT_LEN } from "../../core/risk-engine-core";
import {
  WASM_ABI_VERSION,
  WASM_PROTOCOL_LEN,
  WASM_SOIL_INPUT_BYTES,
  WASM_SOIL_INPUT_FLOATS,
  WASM_SOIL_MEMORY_BUDGET_BYTES,
  WASM_SOIL_OFFSET,
  WASM_SOIL_OUTPUT_BYTES,
  decodeWasmSoilInput,
  encodeWasmSoilInput,
  readProtocolVectorFromView,
  wasmSoilInputByteOffset,
  type WasmSoilCoreInput,
} from "../../core/wasm-soil-ffi";

export {
  WASM_ABI_VERSION,
  WASM_PROTOCOL_LEN,
  WASM_SOIL_OFFSET,
  WASM_SOIL_INPUT_FLOATS,
  WASM_SOIL_INPUT_BYTES,
  WASM_SOIL_OUTPUT_BYTES,
  WASM_SOIL_MEMORY_BUDGET_BYTES,
  encodeWasmSoilInput,
  decodeWasmSoilInput,
  readProtocolVectorFromView,
  wasmSoilInputByteOffset,
  type WasmSoilCoreInput,
};

export const WASM_SOIL_MAX_SLIPPAGE_BPS = 50;
export const WASM_SOIL_DEFAULT_SLIPPAGE_FUSE = 0.005;
export const WASM_SOIL_MIN_DEPTH_USD = 100_000;
export const WASM_SOIL_TESTNET_MIN_DEPTH_USD = 5_000;

if (WASM_PROTOCOL_LEN !== PROTO_VECT_LEN) {
  throw new Error(`Wasm FFI drift: WASM_PROTOCOL_LEN=${WASM_PROTOCOL_LEN} PROTO_VECT_LEN=${PROTO_VECT_LEN}`);
}

export interface WasmSoilCoreOutput {
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  tripped: boolean;
  soilRiskUsd: number;
  cappedMaxSlUsd: number;
  tripFlags: number;
}

const TRIP_CROSS_VENUE = 1 << 0;
const TRIP_DEPTH = 1 << 1;
const TRIP_INSUFFICIENT = 1 << 2;
const TRIP_PROTOCOL = 1 << 3;

function computeCrossVenueSlippage(hlPerp: number, dydxPerp: number): number {
  return hlPerp > 0 && dydxPerp > 0 ? Math.abs(dydxPerp - hlPerp) / hlPerp : Number.POSITIVE_INFINITY;
}

function computeSpotPerpSlippage(hlSpot: number, hlPerp: number): number {
  return hlSpot > 0 ? Math.abs(hlPerp - hlSpot) / hlSpot : Number.POSITIVE_INFINITY;
}

function computeSoilRiskUsd(orderSizeUsd: number, slippageFuse: number): number {
  return Math.max(0, orderSizeUsd) * Math.max(0, slippageFuse);
}

function computeOrderAwareMaxSlUsd(
  accountBalanceUsd: number,
  orderSizeUsd: number,
  slippageFuse: number,
): number {
  const dynamicMax = Math.max(0, accountBalanceUsd) * 0.01 + 100;
  if (!(orderSizeUsd > 0)) return dynamicMax;
  return Math.min(dynamicMax, computeSoilRiskUsd(orderSizeUsd, slippageFuse));
}

export function runWasmSoilCoreSim(input: WasmSoilCoreInput): WasmSoilCoreOutput {
  const crossVenueSlippage = computeCrossVenueSlippage(input.hlPerp, input.dydxPerp);
  const spotPerpSlippage = computeSpotPerpSlippage(input.hlSpot, input.hlPerp);
  let tripFlags = 0;

  if (!(input.hlPerp > 0) || !(input.dydxPerp > 0)) tripFlags |= TRIP_INSUFFICIENT;
  if (input.hlPerp > 0 && input.dydxPerp > 0 && crossVenueSlippage > input.maxSlippage) {
    tripFlags |= TRIP_CROSS_VENUE;
  }
  if (input.depthUsd >= 0 && input.depthUsd < input.minDepthUsd) tripFlags |= TRIP_DEPTH;
  if (input.protocolMask) tripFlags |= TRIP_PROTOCOL;

  const slipForRisk =
    Number.isFinite(crossVenueSlippage) && crossVenueSlippage >= 0
      ? crossVenueSlippage
      : input.maxSlippage;
  const soilRiskUsd =
    input.orderSizeUsd > 0 ? computeSoilRiskUsd(input.orderSizeUsd, slipForRisk) : 0;
  const cappedMaxSlUsd =
    input.orderSizeUsd > 0 && input.accountBalanceUsd >= 0
      ? computeOrderAwareMaxSlUsd(input.accountBalanceUsd, input.orderSizeUsd, input.maxSlippage)
      : 0;

  return {
    crossVenueSlippage: Number.isFinite(crossVenueSlippage) ? crossVenueSlippage : -1,
    spotPerpSlippage: Number.isFinite(spotPerpSlippage) ? spotPerpSlippage : -1,
    tripped: tripFlags !== 0,
    soilRiskUsd,
    cappedMaxSlUsd,
    tripFlags,
  };
}

export function runWasmSoilCoreSimFromBuffer(buf: ArrayBuffer): WasmSoilCoreOutput {
  return runWasmSoilCoreSim(decodeWasmSoilInput(buf));
}

export function estimateWasmSoilFootprintBytes(scratchSlots = 8): number {
  return WASM_SOIL_INPUT_BYTES + WASM_SOIL_OUTPUT_BYTES + scratchSlots * 8;
}
