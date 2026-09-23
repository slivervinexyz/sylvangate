/**
 * SPDX-License-Identifier: Apache-2.0
 * Retail reflex evaluators — INTENT_RING_U32 + packed soil lane (zero-GC hot path).
 */
import { INTENT_RING_U32 } from "../../core/intent-core-buffers";
import {
  evaluateIntentGateU32Pure,
  hashRetailWalletSlotIndex,
  resetIntentRingSlab,
  slotBaseOffset,
} from "../../core/intent-core-ring";
import { VENUE_DRIFT_REJECTED, MAX_ATTEMPTS_EXCEEDED_SEVERED } from "../../core/intent-mandate";
import {
  computeSoilSlippageMetrics,
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  SOIL_REASON_CROSS_VENUE,
  SOIL_REASON_DEPTH_USD,
} from "../../core/soil-resistance-math";
import {
  INTENT_MAX_ATTEMPTS_DEFAULT,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_TARGET_BIT,
} from "../../core/wasm-intent-ffi";
import { isAddressInAllowlist } from "./address-compare";
import type { ParsedApprove } from "./calldata-types";
import { getVenueBitLut, resolveVenueBitFromLut } from "./venue-bit-lut";
import { evaluateTransportStreamSync, __resetTransportStreamForTests } from "./transport-stream";
import { evaluateIntentGateViaWasm, evaluateSoilViaWasm } from "./wasm-adapter";
import { formatRetailWarning } from "./warnings";
import type { RetailGuardConfig, RetailGuardRejectPayload, RetailSoilQuote } from "./types";

const DEFAULT_MAX_APPROVAL_USD = 10_000;
const WASM_TRIP_CROSS = 1;
const WASM_TRIP_DEPTH = 2;

let channelSevered = false;

function fail(
  code: RetailGuardRejectPayload["code"],
  message: string,
  extra?: Record<string, string | number | boolean>,
): RetailGuardRejectPayload {
  return { code, message, plainTextWarning: formatRetailWarning(code, extra) };
}

export function __resetRetailGuardStateForTests(): void {
  channelSevered = false;
  resetIntentRingSlab();
  __resetTransportStreamForTests();
}

export function evaluateRpcTransportProtocol(config: RetailGuardConfig): RetailGuardRejectPayload | null {
  const sync = evaluateTransportStreamSync(config.preferWasm !== false);
  if (sync.ok) return null;
  return fail("RPC_TRANSPORT_SYNC_FAILED", `RPC_TRANSPORT_SYNC_FAILED:lag=${sync.syncLagScore}:bm=${sync.bitmarkValid ? 1 : 0}`);
}

export function isRetailGuardChannelSevered(): boolean {
  return channelSevered;
}

export function evaluateRetailApproveGate(
  approve: ParsedApprove,
  config: RetailGuardConfig,
): RetailGuardRejectPayload | null {
  const spender = approve.spender;
  const allowed = isAddressInAllowlist(spender, config.allowedSpenders);
  const maxUsd = config.maxApprovalUsd ?? DEFAULT_MAX_APPROVAL_USD;
  const decimals = config.approvalTokenDecimals ?? 18;
  const notional = (Number(approve.amountWei) / 10 ** decimals) * (config.approvalTokenPriceUsd ?? 1);
  if ((approve.infinite && !allowed) || (!allowed && notional > maxUsd)) {
    return fail(
      "UNAUTHORIZED_SPENDER_REJECTED",
      approve.infinite
        ? `UNAUTHORIZED_SPENDER_REJECTED:infinite:spender=${spender}`
        : `UNAUTHORIZED_SPENDER_REJECTED:notional=${notional.toFixed(2)}>max=${maxUsd}`,
      { spender, infinite: approve.infinite },
    );
  }
  return null;
}

export function evaluateRetailVenueAllowlist(
  contract: string | undefined,
  config: RetailGuardConfig,
): RetailGuardRejectPayload | null {
  if (!contract?.trim() || !config.allowedVenues?.length) return null;
  if (isAddressInAllowlist(contract, config.allowedVenues)) return null;
  const norm = contract.trim().toLowerCase();
  return fail("VENUE_DRIFT_REJECTED", `${VENUE_DRIFT_REJECTED}:contract=${norm}`, { contract: norm });
}

function soilReject(cross: boolean, depth: boolean, crossSlip: number, depthUsd: number): RetailGuardRejectPayload | null {
  if (cross) {
    return fail("SLIPPAGE_EXCEEDED", `SLIPPAGE_EXCEEDED:cross=${crossSlip.toFixed(6)}`, {
      crossSlippage: crossSlip.toFixed(4),
    });
  }
  if (depth) {
    return fail("DEPTH_INSUFFICIENT", `DEPTH_INSUFFICIENT:depthUsd=${depthUsd}`, { depthUsd });
  }
  return null;
}

export function evaluateRetailSoilGate(quote: RetailSoilQuote, preferWasm = true): RetailGuardRejectPayload | null {
  if (preferWasm) {
    const wasm = evaluateSoilViaWasm(quote);
    if (wasm) {
      return soilReject(
        (wasm.tripFlags & WASM_TRIP_CROSS) !== 0,
        (wasm.tripFlags & WASM_TRIP_DEPTH) !== 0,
        wasm.crossVenueSlippage,
        quote.depthUsd,
      );
    }
  }
  const soil = computeSoilSlippageMetrics({
    symbol: "",
    hlSpot: quote.hlSpot,
    hlPerp: quote.hlPerp,
    dydxPerp: quote.dydxPerp,
    depthUsd: quote.depthUsd,
    maxSlippage: quote.maxSlippage ?? MAX_SLIPPAGE,
    minDepthUsd: quote.minDepthUsd ?? MIN_DEPTH_USD,
  });
  return soilReject(
    (soil.tripFlags & SOIL_REASON_CROSS_VENUE) !== 0,
    (soil.tripFlags & SOIL_REASON_DEPTH_USD) !== 0,
    soil.crossVenueSlippage,
    quote.depthUsd,
  );
}

function runIntentTs(allowedMask: number, targetVenueBit: number, offset: number, maxAttempts: number) {
  INTENT_RING_U32[offset + INTENT_SLOT_ALLOWED_MASK] = allowedMask;
  INTENT_RING_U32[offset + INTENT_SLOT_TARGET_BIT] = targetVenueBit;
  return evaluateIntentGateU32Pure(offset, allowedMask, targetVenueBit, maxAttempts);
}

export function evaluateRetailIntentGate(
  config: RetailGuardConfig,
  targetVenueBit: number,
): RetailGuardRejectPayload | null {
  if (channelSevered) {
    return fail("CHANNEL_SEVERED", "CHANNEL_SEVERED:hot-key pipeline severed after attempt budget exhaust");
  }
  const allowedMask = config.allowedVenueMask ?? 0;
  if (allowedMask === 0 || targetVenueBit === 0) return null;

  const offset = slotBaseOffset(hashRetailWalletSlotIndex(config.walletAddress));
  const maxAttempts = config.maxAttempts ?? INTENT_MAX_ATTEMPTS_DEFAULT;
  const wasm =
    config.preferWasm !== false
      ? evaluateIntentGateViaWasm(offset, allowedMask, targetVenueBit, maxAttempts)
      : null;
  const gate = wasm ?? runIntentTs(allowedMask, targetVenueBit, offset, maxAttempts);

  if (gate.venueDrift) {
    return fail("VENUE_DRIFT_REJECTED", `${VENUE_DRIFT_REJECTED}:allowed=${allowedMask}&target=${targetVenueBit}=0`, {
      contract: `bit:${targetVenueBit}`,
    });
  }
  if (gate.severChannel) {
    channelSevered = true;
    return fail(
      "MAX_ATTEMPTS_EXCEEDED_SEVERED",
      `${MAX_ATTEMPTS_EXCEEDED_SEVERED}:attempt=${gate.attempts}:limit=${maxAttempts}`,
      { attempts: gate.attempts },
    );
  }
  return null;
}

export { RETAIL_UNKNOWN_VENUE_BIT } from "./venue-bit-lut";
export { compileVenueBitLut, getVenueBitLut } from "./venue-bit-lut";

export function resolveVenueBitFromContract(
  contract: string | undefined,
  contractVenueIndex: Readonly<Record<string, number>> | undefined,
): number {
  return resolveVenueBitFromLut(contract, getVenueBitLut(contractVenueIndex));
}
