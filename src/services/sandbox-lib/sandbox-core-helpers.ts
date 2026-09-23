import type { RiskIntent } from "../../core/risk-engine";
import { buildSystemState, type SystemState } from "../../core/state";
import type { SandboxDiagnosticReport, SandboxGate } from "./sandbox-core-types";

export function resolveMockState(mockState?: Partial<SystemState>): SystemState {
  const base = buildSystemState({
    accountBalanceUsd: mockState?.accountBalanceUsd,
    currentCri: mockState?.currentCri,
    skipHardlockAssert: true,
  });
  const cri = mockState?.currentCri ?? base.currentCri;
  const hardlock = mockState?.hardlock ?? base.hardlock;

  return {
    ...base,
    ...mockState,
    dynamicMaxSL: mockState?.dynamicMaxSL ?? base.dynamicMaxSL,
    hudState: mockState?.hudState ?? base.hudState,
    signingChannelOpen:
      mockState?.signingChannelOpen ?? !(hardlock || cri <= 0),
  };
}

export function buildReport(args: {
  intent: RiskIntent;
  passedGates: SandboxGate[];
  failedGate?: SandboxGate;
  reason?: string;
  suggestedHttpCode?: number;
  startedAt: number;
  executionPath: string[];
}): SandboxDiagnosticReport {
  const isAllowed = !args.failedGate;
  return {
    isAllowed,
    venue: args.intent.venue,
    zeroKeyDryRun: true,
    passedGates: args.passedGates,
    failedGate: args.failedGate,
    reason: args.reason,
    suggestedHttpCode: args.suggestedHttpCode,
    simulatedExecutionTimeMs: Math.max(0, Date.now() - args.startedAt),
    executionPath: args.executionPath,
  };
}
