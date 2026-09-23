/** Protocol vector lane indices — v1.0 Santenmoku f64 layout SSOT. */

export const PROTO_VECT_LEN = 28;
export const PROTO_SLOT = 4;
export const PROTO_GMX = 0;
export const PROTO_PENDLE = 4;
export const PROTO_UNISWAP = 8;
export const PROTO_AAVE = 12;
export const PROTO_MORPHO = 16;
export const PROTO_HL = 20;
export const PROTO_USDAI = 24;

export function packProtocolLane(
  slot: number,
  a: number,
  b: number,
  c: number,
  d: number,
  out: Float64Array,
): Float64Array {
  out[slot] = a;
  out[slot + 1] = b;
  out[slot + 2] = c;
  out[slot + 3] = d;
  return out;
}
