/**
 * 2PC Intent Ledger — shared types.
 */

export type IntentPhase = "PENDING" | "PREPARED" | "COMMITTED" | "ABORTED";

export type IntentLegSide = "BUY" | "SELL" | "SHORT" | "LONG";

export type IntentVenue = "HL" | "POLYMARKET" | "JUPITER" | "GMX";

export interface IntentLeg {
  venue: IntentVenue;
  side: IntentLegSide;
  sizeUsd: number;
  symbol?: string;
}

export interface IntentLegPrepareResult {
  legIndex: number;
  ok: boolean;
  reason?: string;
  /** Simulated fill price for flatten math */
  fillPrice?: number;
  filledUsd?: number;
}

export interface FlattenAction {
  venue: IntentVenue;
  side: IntentLegSide;
  sizeUsd: number;
  reduceOnly: true;
  reason: string;
}

export interface CrossLegIntent {
  id: string;
  legs: [IntentLeg, IntentLeg];
  phase: IntentPhase;
  ttlMs: number;
  createdAt: number;
  preparedAt?: number;
  committedAt?: number;
  abortedAt?: number;
  legResults: IntentLegPrepareResult[];
  flattenActions: FlattenAction[];
  abortReason?: string;
  /** Set when compensating flatten fails and R20 hardlock is triggered */
  hardlocked?: boolean;
}

export interface PrepareLegFn {
  (leg: IntentLeg, legIndex: number, intent: CrossLegIntent): Promise<IntentLegPrepareResult>;
}

export interface CommitLegFn {
  (leg: IntentLeg, legIndex: number, intent: CrossLegIntent): Promise<{ ok: boolean; reason?: string }>;
}

export interface FlattenLegFn {
  (action: FlattenAction, intent: CrossLegIntent): Promise<{ ok: boolean; reason?: string }>;
}

export interface IntentLedgerOptions {
  now?: () => number;
  prepareLeg?: PrepareLegFn;
  commitLeg?: CommitLegFn;
  flattenLeg?: FlattenLegFn;
}

export interface IntentTransitionResult {
  intent: CrossLegIntent;
  ok: boolean;
  reason?: string;
}
