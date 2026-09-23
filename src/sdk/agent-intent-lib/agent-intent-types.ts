/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * @slivervine/exomesh-agentic-wallet-guard — verifyAgentIntent types
 */
import type { ExoMeshSdkPreset } from "../constants";
import type { GateAttestation } from "../attestation";

export type { GateAttestation };

export interface AgentIntentInput {
  intentDigest: string;
  /** Bound into digest via `buildIntentDigest({ chainId, venueKey, action })`. */
  intentAction?: string;
  sessionKey: {
    agentAddress: string;
    maxOrderClipUsd: number;
    expiresAtMs: number | null;
    approvedAtMs?: number;
    /** Venue whitelist — unauthorized protocol switch → `VENUE_DRIFT_REJECTED`. */
    allowedVenues?: readonly string[];
  };
  soil: {
    symbol: string;
    hlSpot: number;
    hlPerp: number;
    dydxPerp: number;
    depthUsd?: number;
    isTestnet?: boolean;
  };
  gasBurst?: {
    estimatedGasCostUsd: number;
    sponsored: boolean;
    dailySpentUsd?: number;
    chainId?: number;
  };
  deadman?: {
    maxSlippageBps?: number;
    soilResistanceThreshold?: number;
  };
  armor?: {
    rpcLatencyMs?: number;
    sandwichRiskBps?: number;
  };
  attestation?: GateAttestation;
  preset?: ExoMeshSdkPreset;
  allowDevBypass?: boolean;
  nowMs?: number;
}

export interface AgentIntentVerdict {
  ok: boolean;
  reasons: string[];
  allowedToSign: boolean;
  clipOk: boolean;
  expiryOk: boolean;
  soilOk: boolean;
  gasBurstOk: boolean;
  sessionOk: boolean;
  deadmanOk: boolean;
  armorOk: boolean;
  hasValidAttestation: boolean;
  wasmUsed: boolean;
  attestation?: { digest: string; expiresAtMs: number; sig: string };
  verifyingContract: string;
  domainName: string;
}
