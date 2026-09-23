/** Section 1 HUD shared types + constants (no adapter/UI imports). */

import type { Verified5TxResults } from "../../../data/verified-5tx";

export const MEV_ATTACK_BASELINE_BPS = 28.5;
export const MEV_RECOVERY_SAVED_BPS = 142;
export const SOIL_CHECK_DELAY_MS = 500;
export const PING_INTERVAL_MS = 3_000;
export const PING_MIN_MS = 12;
export const PING_MAX_MS = 18;
export const EMPTY_BATCH_LABEL = "No Executed Batches Yet";

export type MevAttackPhase = "idle" | "alarm" | "recovered";

export interface TxBatchRecord {
  id: string;
  batchNumber: number;
  dateLabel: string;
  filledLabel: string;
  anchorHash: string;
  results: Verified5TxResults;
  displayLabel?: string;
}

export interface SoilResistanceLogEntry {
  at: string;
  tripped: boolean;
  crossVenueSlippagePct: number;
  reasons: string[];
}

export interface SilvervineTcaAuditProof {
  protocol: "SliverVine";
  engine: "v1.0 Santenmoku";
  exportedAt: string;
  batchId: string;
  sha256Anchor: string;
  fillHashes: string[];
  sessionKey: string;
  soilResistanceLogs: SoilResistanceLogEntry[];
}

export interface Sha256AuditCertificate {
  protocol: "SliverVine";
  engine: "v1.0 Santenmoku";
  certificateVersion: "c1";
  exportedAt: string;
  batchId: string;
  sha256Anchor: string;
  fillHashes: string[];
  sessionKey: string;
  soilResistanceLogs: SoilResistanceLogEntry[];
  markdown: string;
  certificateSignature: string;
}

export interface DryRunPlaybookStep {
  step: number;
  venue: "HL" | "POLYMARKET" | "JUPITER";
  event: "GRANT_SANDBOX_DRY_RUN";
  zeroKeyDryRun: true;
  apiKeysRequired: false;
  sagaPhase: "PREPARE" | "VERIFY" | "COMMIT" | "COMPENSATE";
  tradeAllowed: boolean;
  passedGates: string[];
}

export interface DryRunPlaybookJson {
  protocol: "SliverVine";
  engine: "v1.0 Santenmoku";
  playbookVersion: "c15";
  exportedAt: string;
  zeroKeyDryRun: true;
  apiKeysRequired: false;
  hyperliquidTestnetCompatible: true;
  sha256Anchor: string;
  timestamp: string;
  soilAuditLogs: SoilResistanceLogEntry[];
  sagaEngine: {
    phases: readonly ["PREPARE", "VERIFY", "COMMIT", "COMPENSATE"];
    failClosedMs: 500;
  };
  verified5TxBatch: {
    wallet: string;
    fillCount: number;
    fillHashes: string[];
  };
  sandboxSequence: DryRunPlaybookStep[];
}
