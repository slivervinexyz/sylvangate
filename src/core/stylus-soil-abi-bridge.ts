/**
 * Edge f64 soil lane ↔ Stylus u64 packed ABI bridge.
 * SSOT: `contracts/sanctuary_invariants/src/abi.rs` · `soil_eval_u64.rs`.
 */

export const STYLUS_PACKED_LEN = 96;
export const STYLUS_OFF_SPREAD_BPS = 48;
export const STYLUS_OFF_DEPTH_USD = 56;
export const STYLUS_OFF_SLIPPAGE_SOIL = 64;
export const STYLUS_OFF_PROTOCOL_MASK = 72;

export const STYLUS_MIN_DEPTH_USD = 100_000;
export const STYLUS_MAX_SPREAD_BPS = 50;
export const STYLUS_SOIL_REASON_CROSS = 1 << 1;
export const STYLUS_SOIL_REASON_DEPTH = 1 << 2;
export const STYLUS_SOIL_REASON_PROTOCOL = 1 << 3;

/** Edge maxSlippage ratio (0.005) ≡ Stylus spread cap (50 bps). */
export const EDGE_STYLUS_SLIPPAGE_BPS_RATIO = 10_000;

export interface EdgeSoilLaneInput {
  hlPerp: number;
  dydxPerp: number;
  depthUsd: number;
  maxSlippage: number;
  minDepthUsd: number;
  protocolMask?: number;
}

export interface SoilTripSemantics {
  crossVenue: boolean;
  depth: boolean;
  insufficient: boolean;
  protocol: boolean;
}

function readU64Le(buf: Uint8Array, off: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lo = view.getUint32(off, true);
  const hi = view.getUint32(off + 4, true);
  return lo + hi * 0x1_0000_0000;
}

function writeU64Le(buf: Uint8Array, off: number, value: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let v = Math.max(0, Math.floor(value));
  view.setUint32(off, v >>> 0, true);
  view.setUint32(off + 4, Math.floor(v / 0x1_0000_0000), true);
}

export function edgeCrossSlippageRatio(hlPerp: number, dydxPerp: number): number {
  if (hlPerp <= 0 || dydxPerp <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(dydxPerp - hlPerp) / hlPerp;
}

export function edgeCrossSlippageBps(hlPerp: number, dydxPerp: number): number {
  const ratio = edgeCrossSlippageRatio(hlPerp, dydxPerp);
  if (!Number.isFinite(ratio)) return Number.POSITIVE_INFINITY;
  return ratio * EDGE_STYLUS_SLIPPAGE_BPS_RATIO;
}

/** Map Edge f64 lane → Stylus 96-byte packed soil offsets (zeroes GMX header). */
export function packStylusSoilFromEdge(
  input: EdgeSoilLaneInput,
  out?: Uint8Array,
): Uint8Array {
  const buf = out ?? new Uint8Array(STYLUS_PACKED_LEN);
  buf.fill(0);
  const spreadBps = Math.round(edgeCrossSlippageBps(input.hlPerp, input.dydxPerp));
  const spreadU64 = Number.isFinite(spreadBps) ? spreadBps : 0xffff_ffff;
  writeU64Le(buf, STYLUS_OFF_SPREAD_BPS, spreadU64);
  writeU64Le(buf, STYLUS_OFF_DEPTH_USD, Math.round(input.depthUsd));
  writeU64Le(buf, STYLUS_OFF_SLIPPAGE_SOIL, Math.round(input.maxSlippage * EDGE_STYLUS_SLIPPAGE_BPS_RATIO));
  writeU64Le(buf, STYLUS_OFF_PROTOCOL_MASK, input.protocolMask ?? 0);
  return buf;
}

/** Pure TS mirror of `soil_eval_u64::eval` — golden-vector SSOT for Stylus tier. */
export function evaluateStylusSoilU64Pure(packed: Uint8Array): {
  tripFlags: number;
  score: number;
} {
  const spreadBps = readU64Le(packed, STYLUS_OFF_SPREAD_BPS);
  const depthUsd = readU64Le(packed, STYLUS_OFF_DEPTH_USD);
  const slippageBps = readU64Le(packed, STYLUS_OFF_SLIPPAGE_SOIL);
  const protocolMask = readU64Le(packed, STYLUS_OFF_PROTOCOL_MASK);

  let flags = 0;
  if (depthUsd < STYLUS_MIN_DEPTH_USD) flags |= STYLUS_SOIL_REASON_DEPTH;
  if (spreadBps > STYLUS_MAX_SPREAD_BPS) flags |= STYLUS_SOIL_REASON_CROSS;
  if (protocolMask !== 0) flags |= STYLUS_SOIL_REASON_PROTOCOL;

  const score = spreadBps * 100 + slippageBps * 120;
  return { tripFlags: flags, score };
}

export function edgeSoilTripSemantics(
  tripFlags: number,
  hlPerp: number,
  dydxPerp: number,
  depthUsd: number,
  minDepthUsd: number,
  maxSlippage: number,
  protocolMask = 0,
): SoilTripSemantics {
  const cross = edgeCrossSlippageRatio(hlPerp, dydxPerp);
  return {
    crossVenue: hlPerp > 0 && dydxPerp > 0 && cross > maxSlippage,
    depth: Number.isFinite(depthUsd) && depthUsd < minDepthUsd,
    insufficient: hlPerp <= 0 || dydxPerp <= 0,
    protocol: protocolMask !== 0 || (tripFlags & 8) !== 0,
  };
}

export function stylusSoilTripSemantics(tripFlags: number): SoilTripSemantics {
  return {
    crossVenue: (tripFlags & STYLUS_SOIL_REASON_CROSS) !== 0,
    depth: (tripFlags & STYLUS_SOIL_REASON_DEPTH) !== 0,
    insufficient: false,
    protocol: (tripFlags & STYLUS_SOIL_REASON_PROTOCOL) !== 0,
  };
}

/** Assert Edge f64 maxSlippage aligns with Stylus spread bps cap. */
export function edgeMaxSlippageToStylusBps(maxSlippage: number): number {
  return Math.round(maxSlippage * EDGE_STYLUS_SLIPPAGE_BPS_RATIO);
}

/** Map `soil_core_eval` rust flags (1=cross · 2=depth · 4=insufficient · 8=protocol) → Stylus u64 soil mask. */
export function mapCoreRustTripFlagsToStylusU64(rustTripFlags: number): number {
  let out = 0;
  if (rustTripFlags & 1) out |= STYLUS_SOIL_REASON_CROSS;
  if (rustTripFlags & 2) out |= STYLUS_SOIL_REASON_DEPTH;
  if (rustTripFlags & 8) out |= STYLUS_SOIL_REASON_PROTOCOL;
  return out;
}

/** PolicyGuardV2 pre-screen: pack Edge lane + core soil flags into Stylus 96-byte eval input. */
export function packPolicyGuardSoilScreen(
  input: EdgeSoilLaneInput,
  coreRustTripFlags = 0,
): Uint8Array {
  const buf = packStylusSoilFromEdge(input);
  if (coreRustTripFlags !== 0) {
    const merged = readU64Le(buf, STYLUS_OFF_PROTOCOL_MASK) | mapCoreRustTripFlagsToStylusU64(coreRustTripFlags);
    writeU64Le(buf, STYLUS_OFF_PROTOCOL_MASK, merged);
  }
  return buf;
}
