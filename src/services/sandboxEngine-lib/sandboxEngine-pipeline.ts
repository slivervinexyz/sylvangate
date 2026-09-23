/**
 * Dry-Run Sandbox Engine — E2E pipeline orchestration.
 */

import type { SystemState } from "../systemState";
import { buildSystemState } from "../systemState";
import { checkSoilResistance } from "../risk-control";
import {
  executeOrder,
  type HyperliquidFillResult,
} from "../hyperliquidAdapter";
import type { SessionKeyOrderPayload } from "../session-key-adapter";
import { simulateTransactionIntent, type SandboxDiagnosticReport } from "../sandbox";
import {
  buildSoilFromTick,
  createInitialTick,
  type SandboxMarketTick,
  type SandboxTickScenario,
} from "./sandboxEngine-tick";
import {
  evaluateRootProtectionSuite,
  resolveExecutionMode,
  type HyperliquidAdapterConfig,
  type SandboxProtectionSnapshot,
} from "./sandboxEngine-protection";
import type { SandboxExecutionMode } from "./sandboxEngine-tick";

export interface SandboxPipelineResult {
  mode: SandboxExecutionMode;
  state: SystemState;
  tick: SandboxMarketTick;
  fill: HyperliquidFillResult | null;
  protection: SandboxProtectionSnapshot;
  sandboxReport: SandboxDiagnosticReport;
  executionPath: string[];
  elapsedMs: number;
}

export async function executeSandboxOrder(input: {
  state: SystemState;
  tick: SandboxMarketTick;
  payload: SessionKeyOrderPayload;
  config?: HyperliquidAdapterConfig;
}): Promise<HyperliquidFillResult> {
  const soil = buildSoilFromTick(input.tick);
  const dryRun = resolveExecutionMode(input.state, input.config) === "SANDBOX";

  return executeOrder({
    payload: input.payload,
    soil,
    tickVelocity: input.tick.tickVelocity,
    systemState: input.state,
    config: { ...input.config, dryRun: dryRun || input.config?.dryRun },
  });
}

/** Full E2E dry-run pipeline — tick → root protection → mock fill. */
export async function runSandboxPipeline(
  input: {
    state?: Partial<SystemState>;
    tick?: SandboxMarketTick;
    payload?: SessionKeyOrderPayload;
    amountUsd?: number;
    scenario?: SandboxTickScenario;
    slippageRatio?: number;
    unrealizedLossUsd?: number;
    actionTimestamps?: number[];
    expectedBalanceUsd?: number;
    observedBalanceUsd?: number;
    now?: number;
  } = {},
): Promise<SandboxPipelineResult> {
  const startedAt = Date.now();
  const executionPath: string[] = ["sandboxEngine:start"];

  const base = buildSystemState({
    accountBalanceUsd: input.state?.accountBalanceUsd,
    currentCri: input.state?.currentCri,
    isSandboxMode: input.state?.isSandboxMode,
    skipHardlockAssert: true,
  });
  const mergedState: SystemState = {
    ...base,
    ...input.state,
    isSandboxMode: input.state?.isSandboxMode ?? true,
  };

  const mode = resolveExecutionMode(mergedState);
  executionPath.push(`mode:${mode.toLowerCase()}`);

  const tick = input.tick ?? createInitialTick();
  executionPath.push(`tick:${tick.symbol}@${tick.markPx}`);

  const soil = buildSoilFromTick(tick);
  const soilAudit = checkSoilResistance(soil);
  executionPath.push(
    soilAudit.tripped ? "soil:resistance:trip" : "soil:resistance:pass",
  );

  const protection = evaluateRootProtectionSuite({
    state: mergedState,
    tick,
    slippageRatio: input.slippageRatio,
    unrealizedLossUsd: input.unrealizedLossUsd,
    actionTimestamps: input.actionTimestamps,
    expectedBalanceUsd: input.expectedBalanceUsd,
    observedBalanceUsd: input.observedBalanceUsd,
    now: input.now,
  });
  executionPath.push(
    protection.circuitBreaker.tripped
      ? "protection:circuit-breaker:trip"
      : "protection:circuit-breaker:pass",
  );
  executionPath.push(
    protection.takeover.systemTakeover.isOverridden
      ? "protection:takeover:active"
      : "protection:takeover:pass",
  );
  executionPath.push(
    protection.capitalLeak.leaked
      ? "protection:capital-leak:trip"
      : "protection:capital-leak:pass",
  );

  const payload: SessionKeyOrderPayload = input.payload ?? {
    asset: tick.asset,
    isBuy: true,
    limitPx: String(Math.floor(tick.bestAsk)),
    sz: "0.01",
    reduceOnly: false,
    orderType: { limit: { tif: "Gtc" } },
  };

  let fill: HyperliquidFillResult | null = null;
  const blocked =
    mergedState.hardlock ||
    protection.circuitBreaker.tripped ||
    protection.capitalLeak.leaked ||
    soilAudit.tripped;

  if (!blocked) {
    fill = await executeSandboxOrder({
      state: mergedState,
      tick,
      payload,
      config: {},
    });
    executionPath.push(
      fill.success ? "fill:mock:success" : "fill:mock:reject",
    );
  } else {
    executionPath.push("fill:blocked");
  }

  const sandboxReport = simulateTransactionIntent(
    {
      venue: "HL",
      amountUsd: input.amountUsd ?? 50,
      symbol: tick.symbol,
      soil,
    },
    mergedState,
  );
  executionPath.push("sandbox:complete");

  return {
    mode,
    state: mergedState,
    tick,
    fill,
    protection,
    sandboxReport,
    executionPath,
    elapsedMs: Date.now() - startedAt,
  };
}
