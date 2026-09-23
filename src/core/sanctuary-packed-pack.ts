/**
 * 96-byte sanctuary packed layout — mirrors `SanctuaryInvariantsPackLib` / `abi.rs`.
 */
import { STYLUS_PACKED_LEN } from "./stylus-soil-abi-bridge";
import type { GmxGmRiskAuditContext } from "./gmx-risk-core";

export const SANCTUARY_PACKED_LEN = STYLUS_PACKED_LEN;

export const SANCTUARY_OFF_EXECUTION_FEE = 0;
export const SANCTUARY_OFF_MIN_MARKET = 8;
export const SANCTUARY_OFF_EXPECTED_MARKET = 16;
export const SANCTUARY_OFF_SLIPPAGE_BPS = 24;
export const SANCTUARY_OFF_POOL_LONG = 32;
export const SANCTUARY_OFF_POOL_SHORT = 40;

export type GmxWirePackInput = {
  executionFee: bigint;
  minMarketTokens?: bigint;
  minLongTokenAmount?: bigint;
  minShortTokenAmount?: bigint;
};

/** Pack GMX wire + audit ctx into 96-byte sanctuary eval buffer (reuses `out` when provided). */
export function packSanctuaryGmxWireEval(
  ctx: GmxGmRiskAuditContext,
  wire: GmxWirePackInput,
  out?: Uint8Array,
): Uint8Array {
  const buf = out ?? new Uint8Array(SANCTUARY_PACKED_LEN);
  buf.fill(0);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigUint64(SANCTUARY_OFF_EXECUTION_FEE, wire.executionFee, true);
  view.setBigUint64(SANCTUARY_OFF_MIN_MARKET, wire.minMarketTokens ?? wire.minLongTokenAmount ?? 0n, true);
  view.setBigUint64(SANCTUARY_OFF_EXPECTED_MARKET, ctx.expectedMarketTokens ?? ctx.expectedLongTokenAmount ?? 0n, true);
  const slip = ctx.slippageBps === undefined || ctx.slippageBps === 0 ? 30 : Math.min(10_000, Math.trunc(ctx.slippageBps));
  view.setUint16(SANCTUARY_OFF_SLIPPAGE_BPS, slip, true);
  view.setBigUint64(SANCTUARY_OFF_POOL_LONG, BigInt(Math.round(ctx.poolLongUsd ?? 0)), true);
  view.setBigUint64(SANCTUARY_OFF_POOL_SHORT, BigInt(Math.round(ctx.poolShortUsd ?? 0)), true);
  view.setBigUint64(48, 30n, true);
  view.setBigUint64(56, 500_000n, true);
  view.setBigUint64(64, 10n, true);
  return buf;
}
