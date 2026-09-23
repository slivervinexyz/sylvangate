/** Grant Audit v0.9 — Formula 1-3 zero-gas simulation SSOT (private engine). */
import { RISK_ORACLE_FAIL_CLOSED_STATUS_CODE } from "../aa-adapter/risk-oracle";

export const F1_PHASE_SHIFT_RPC_MIN_MS = 15;
export const F1_PHASE_SHIFT_RPC_MAX_MS = 200;
export const F2_FCI_FREEZE_THRESHOLD = 0.82;
export const F3_DELTA_HP_EVAC_THRESHOLD = 0.72;

export interface AnvilForkState {
  baseFeeWei: bigint;
  blockNumber: number;
}

export interface LiquiditySensorSnapshot {
  hlDepthUsd: number;
  gmxDepthUsd: number;
  dydxDepthUsd: number;
}

export interface GrantV09SimInput {
  prevBaseFeeGwei: number;
  nextBaseFeeGwei: number;
  rpcJitterMs: number;
  liquidity: LiquiditySensorSnapshot;
  settled?: boolean;
}

export interface GrantV09SimVerdict {
  phaseShift: number;
  fci: number;
  deltaHp: number;
  statusCode: 0 | 1 | 3;
  systemStatus: "NOMINAL" | "ELEVATED" | "FAIL_CLOSED";
  newPositionsFrozen: boolean;
  healthChecksActive: boolean;
  evacuationTriggered: boolean;
  preemptiveEvacuation: boolean;
}

export interface GrantV09PublicPayload {
  statusCode: number;
  system_status: string;
  newPositionsFrozen: boolean;
  healthChecksActive: boolean;
  evacuationTriggered: boolean;
}

/** In-memory Anvil fork — zero mainnet gas. */
export class AnvilForkSimulator {
  private state: AnvilForkState = { baseFeeWei: 100_000_000n, blockNumber: 1 };

  getState(): AnvilForkState {
    return { ...this.state };
  }

  async setNextBlockBaseFeePerGas(wei: bigint): Promise<void> {
    this.state = { ...this.state, baseFeeWei: wei, blockNumber: this.state.blockNumber + 1 };
  }

  baseFeeGwei(): number {
    return Number(this.state.baseFeeWei) / 1e9;
  }
}

/** Exponential RPC jitter ramp (15ms → 200ms). */
export function buildRpcJitterRamp(steps: number): number[] {
  if (steps <= 1) return [F1_PHASE_SHIFT_RPC_MIN_MS];
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const ms = F1_PHASE_SHIFT_RPC_MIN_MS * Math.exp(t * Math.log(F1_PHASE_SHIFT_RPC_MAX_MS / F1_PHASE_SHIFT_RPC_MIN_MS));
    out.push(ms);
  }
  return out;
}

/** F1 — phase shift from base-fee growth + RPC jitter. */
export function computePhaseShift(prevGwei: number, nextGwei: number, rpcJitterMs: number): number {
  const growth = prevGwei > 0 ? Math.max(0, Math.log(nextGwei / prevGwei)) : 0;
  const jitter = Math.min(1, rpcJitterMs / F1_PHASE_SHIFT_RPC_MAX_MS);
  return growth * (1 + jitter);
}

/** F2 — cross-sensor liquidity collapse index. */
export function computeFci(liquidity: LiquiditySensorSnapshot): number {
  const depths = [liquidity.hlDepthUsd, liquidity.gmxDepthUsd, liquidity.dydxDepthUsd].filter((d) => d > 0);
  if (depths.length === 0) return 1;
  const min = Math.min(...depths);
  const max = Math.max(...depths);
  return 1 - min / Math.max(max, 1);
}

/** F3 — pre-emptive evacuation entropy proxy. */
export function computeDeltaHp(phaseShift: number, rpcJitterMs: number): number {
  const tau = Math.min(1, rpcJitterMs / F1_PHASE_SHIFT_RPC_MAX_MS);
  return Math.min(1, 0.5 * Math.tanh(phaseShift) + 0.5 * tau);
}

export function evaluateGrantV09Risk(input: GrantV09SimInput): GrantV09SimVerdict {
  const phaseShift = computePhaseShift(input.prevBaseFeeGwei, input.nextBaseFeeGwei, input.rpcJitterMs);
  const fci = computeFci(input.liquidity);
  const deltaHp = computeDeltaHp(phaseShift, input.rpcJitterMs);

  const fciFreeze = fci > F2_FCI_FREEZE_THRESHOLD;
  const preemptiveEvacuation = !input.settled && deltaHp > F3_DELTA_HP_EVAC_THRESHOLD;
  const evacuationTriggered = preemptiveEvacuation || fciFreeze;

  let statusCode: 0 | 1 | 3 = 0;
  let systemStatus: GrantV09SimVerdict["systemStatus"] = "NOMINAL";
  if (evacuationTriggered) {
    statusCode = RISK_ORACLE_FAIL_CLOSED_STATUS_CODE as 3;
    systemStatus = "FAIL_CLOSED";
  } else if (fci > 0.5 || deltaHp > 0.4) {
    statusCode = 1;
    systemStatus = "ELEVATED";
  }

  return {
    phaseShift,
    fci,
    deltaHp,
    statusCode,
    systemStatus,
    newPositionsFrozen: fciFreeze,
    healthChecksActive: true,
    evacuationTriggered,
    preemptiveEvacuation,
  };
}

/** Public grant payload — no internal formula fields. */
export function toPublicGrantSimPayload(verdict: GrantV09SimVerdict): GrantV09PublicPayload {
  return {
    statusCode: verdict.statusCode,
    system_status: verdict.systemStatus,
    newPositionsFrozen: verdict.newPositionsFrozen,
    healthChecksActive: verdict.healthChecksActive,
    evacuationTriggered: verdict.evacuationTriggered,
  };
}

const LEAK_RE =
  /PhaseShift|Delta_Hp|DeltaHp|\bfci\b|hawking|0\.72|0\.82|Formula\s*[123]|phaseShift|deltaHp/i;

export function assertNoFormulaLeakInPublicPayload(payload: unknown): void {
  const raw = JSON.stringify(payload);
  if (LEAK_RE.test(raw)) throw new Error("GRANT_SIM_PUBLIC_LEAK");
}

export function benchmarkGrantV09Risk(iterations: number, input: GrantV09SimInput): number {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    evaluateGrantV09Risk(input);
    samples.push((performance.now() - t0) * 1000);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}
