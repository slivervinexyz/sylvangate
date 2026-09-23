import type { RiskVenue } from "../../core/risk-engine";

export type SandboxGate =
  | "R20_LOCK"
  | "ROOT_PROTECTION"
  | "FOOL_PROOF_GUARD"
  | "SOIL_RESISTANCE"
  | "HL_DRY_RUN";

export interface SandboxDiagnosticReport {
  isAllowed: boolean;
  venue: RiskVenue;
  zeroKeyDryRun: true;
  passedGates: SandboxGate[];
  failedGate?: SandboxGate;
  reason?: string;
  suggestedHttpCode?: number;
  simulatedExecutionTimeMs: number;
  executionPath: string[];
}
