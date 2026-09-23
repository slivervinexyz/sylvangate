/** Host adapter — wires SoilResistanceInput into pure `intent-core` u32 ring slab. */
import { hashAbiString } from "../utils/abi-keccak";
import {
  checkVenueDriftPure,
  hashKeyToSlotIndex,
  INTENT_MAX_ATTEMPTS_DEFAULT,
  INTENT_RING_U32,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_TARGET_BIT,
  resetIntentRingSlab,
  slotBaseOffset,
  trackAttemptBudgetU32Pure,
  venueKeyToBitPure,
} from "./intent-core";
import { FLAGS_SEVERED } from "./risk-flags";
import { severSigningChannel } from "./state-store";
import type { SoilResistanceInput, SoilResistanceResult } from "./soil-resistance-types";

export const VENUE_DRIFT_REJECTED = "VENUE_DRIFT_REJECTED" as const;
export const MAX_ATTEMPTS_EXCEEDED_SEVERED = "MAX_ATTEMPTS_EXCEEDED_SEVERED" as const;
export const INTENT_DIGEST_MISMATCH = "INTENT_DIGEST_MISMATCH" as const;
export const MAX_ATTEMPTS_PER_INTENT = INTENT_MAX_ATTEMPTS_DEFAULT;

/** Wire-locked v1 mandate digest prefix (Sanctuary Module B). */
export const INTENT_DIGEST_PREFIX_V1 = "sanctuary:intent:v1:" as const;

export interface IntentDigestInput {
  chainId: number;
  venueKey: string;
  action: string;
}

/** Core venue indices — bits 2–4 reserved (RESERVED_ABI_V2) for pruned Uniswap/Aave/Morpho. */
const VENUE_KEY_INDEX: Record<string, number> = {
  gmx: 0,
  pendle: 1,
  usdai: 5,
  usd: 5,
  hyperliquid: 6,
  hl: 6,
  variational: 7,
  var: 7,
};

export function __resetIntentAttemptTrackerForTests(): void {
  resetIntentRingSlab();
}

export function normalizeVenueKey(venue: string): string {
  return venue.trim().toLowerCase();
}

export function venueKeyToIndex(venueKey: string): number | undefined {
  return VENUE_KEY_INDEX[normalizeVenueKey(venueKey)];
}

export function venueKeysToMask(venueKeys: readonly string[]): bigint {
  let mask = 0n;
  for (let i = 0; i < venueKeys.length; i += 1) {
    const idx = venueKeyToIndex(venueKeys[i]!);
    if (idx !== undefined) mask |= venueKeyToBitPure(idx);
  }
  return mask;
}

export function buildIntentDigest(input: IntentDigestInput): `0x${string}` {
  const chainId = Math.trunc(input.chainId);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error("INTENT_DIGEST_CHAIN_ID_INVALID");
  }
  const venueKey = normalizeVenueKey(input.venueKey);
  const action = input.action.trim();
  if (!venueKey || !action) throw new Error("INTENT_DIGEST_FIELDS_REQUIRED");
  return hashAbiString(`${INTENT_DIGEST_PREFIX_V1}${chainId}:${venueKey}:${action}`);
}

function resolveTargetVenue(input: SoilResistanceInput): string | null {
  const raw = input.targetVenue ?? input.venueKey;
  if (!raw?.trim()) return null;
  return normalizeVenueKey(raw);
}

function resolveAttemptKey(input: SoilResistanceInput): string | null {
  const digest = input.intentDigest?.trim().toLowerCase();
  if (digest && /^0x[a-f0-9]{64}$/.test(digest)) return digest;
  const agentId = input.agentId?.trim();
  if (agentId) return `agent:${agentId}`;
  return null;
}

function resolveAttemptSlotOffset(key: string): number {
  return slotBaseOffset(hashKeyToSlotIndex(key));
}

function mandateTrip(reasons: string[], sever = true): SoilResistanceResult {
  if (sever) severSigningChannel();
  return {
    ok: false,
    tripped: true,
    crossVenueSlippage: -1,
    spotPerpSlippage: -1,
    reasons,
  };
}

/** Venue whitelist + digest bind + attempt budget — fail-closed before soil math. */
export function evaluateIntentMandateGate(input: SoilResistanceInput): SoilResistanceResult | null {
  const targetVenue = resolveTargetVenue(input);
  const allowed = input.allowedVenues;
  const targetIdx = targetVenue ? venueKeyToIndex(targetVenue) : undefined;
  const targetBit = targetIdx !== undefined ? venueKeyToBitPure(targetIdx) : 0n;
  const allowedMask = allowed && allowed.length > 0 ? venueKeysToMask(allowed) : 0n;

  if (targetVenue && allowedMask !== 0n && !checkVenueDriftPure(allowedMask, targetBit)) {
    return mandateTrip([`${VENUE_DRIFT_REJECTED}:target=${targetVenue}`]);
  }

  const chainId = input.chainId;
  const action = input.intentAction?.trim();
  const digest = input.intentDigest?.trim();
  if (
    digest &&
    /^0x[a-fA-F0-9]{64}$/.test(digest) &&
    targetVenue &&
    action &&
    chainId !== undefined &&
    Number.isFinite(chainId)
  ) {
    const expected = buildIntentDigest({ chainId, venueKey: targetVenue, action }).toLowerCase();
    if (digest.toLowerCase() !== expected) {
      return mandateTrip([INTENT_DIGEST_MISMATCH, VENUE_DRIFT_REJECTED]);
    }
  }

  const attemptKey = resolveAttemptKey(input);
  if (!attemptKey) return null;

  const offset = resolveAttemptSlotOffset(attemptKey);
  if (allowedMask !== 0n && targetIdx !== undefined) {
    INTENT_RING_U32[offset + INTENT_SLOT_ALLOWED_MASK] = Number(allowedMask);
    INTENT_RING_U32[offset + INTENT_SLOT_TARGET_BIT] = 1 << targetIdx;
  }
  const budget = trackAttemptBudgetU32Pure(offset, MAX_ATTEMPTS_PER_INTENT);
  if (!budget.allowed) {
    severSigningChannel();
    return mandateTrip(
      [
        `${MAX_ATTEMPTS_EXCEEDED_SEVERED}:attempt=${budget.nextAttempts}:limit=${MAX_ATTEMPTS_PER_INTENT}`,
        `FLAGS_SEVERED=${FLAGS_SEVERED}`,
      ],
      true,
    );
  }

  return null;
}

export function hasIntentMandateFields(input: SoilResistanceInput): boolean {
  return (
    (input.allowedVenues?.length ?? 0) > 0 ||
    Boolean(input.intentDigest?.trim()) ||
    Boolean(input.agentId?.trim()) ||
    Boolean(input.targetVenue?.trim()) ||
    Boolean(input.venueKey?.trim())
  );
}
