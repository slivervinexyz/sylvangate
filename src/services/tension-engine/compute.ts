import { simulateDemoCell, type DemoSimScenario } from "../demo-simulator-service";
import { TOPOLOGY_SHIELD_TREE } from "./topology-shield-tree";
import type {
  TopologyShieldCard,
  TopologyNodeId,
  ShieldMorphId,
  TensionAnimal,
  TensionEngineInput,
  TensionEngineResult,
} from "./types";

const SCENARIO_STRESS: Readonly<Record<DemoSimScenario, number>> = {
  NORMAL_RANGING: 12,
  HIGH_VOLATILITY_SQUEEZE: 48,
  PREDATORY_MEV_ATTACK: 72,
  FLASH_CRASH_BLACK_SWAN: 92,
  LIQUIDITY_HOLE_VACUUM: 78,
  ORACLE_RPC_DISTORTION: 66,
};

const SCENARIO_ACTIVE_TOPOLOGY: Readonly<
  Record<DemoSimScenario, readonly TopologyNodeId[]>
> = {
  NORMAL_RANGING: ["NODE_ALPHA", "NODE_LAMBDA", "NODE_OMEGA"],
  HIGH_VOLATILITY_SQUEEZE: ["NODE_SIGMA", "NODE_DELTA", "NODE_LAMBDA"],
  PREDATORY_MEV_ATTACK: ["NODE_KAPPA", "NODE_SIGMA", "NODE_ALPHA"],
  FLASH_CRASH_BLACK_SWAN: ["NODE_THETA", "NODE_DELTA", "NODE_ZETA"],
  LIQUIDITY_HOLE_VACUUM: ["NODE_DELTA", "NODE_THETA", "NODE_SIGMA"],
  ORACLE_RPC_DISTORTION: ["NODE_KAPPA", "NODE_LAMBDA", "NODE_ALPHA"],
};

const SHIELD_LABELS: Readonly<Record<ShieldMorphId, string>> = {
  BASE_AEGIS_SHIELD: "Base Aegis Shield",
  ANTI_MEV_COUNTER_SHIELD: "Anti-MEV Counter Shield",
  RUIN_LOCK_SHIELD: "Ruin Lock Shield",
  PUBLIC_BASE_UNPROTECTED: "Public v0.8 Base (Unprotected)",
};

function clampTension(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

function resolveAnimal(tension: number): {
  animal: TensionAnimal;
  animalEmoji: string;
  tensionLabel: string;
} {
  if (tension >= 80) {
    return { animal: "cat", animalEmoji: "🐱", tensionLabel: "Calm" };
  }
  if (tension >= 40) {
    return { animal: "bear", animalEmoji: "🐻", tensionLabel: "Stress" };
  }
  if (tension >= 10) {
    return { animal: "eagle", animalEmoji: "🦅", tensionLabel: "Anti-MEV" };
  }
  return { animal: "hedgehog", animalEmoji: "🦔", tensionLabel: "Lock" };
}

function resolveShieldMorph(
  scenario: DemoSimScenario,
  adaptive: boolean,
  tension: number,
): ShieldMorphId {
  if (!adaptive) {
    return scenario === "NORMAL_RANGING"
      ? "PUBLIC_BASE_UNPROTECTED"
      : "RUIN_LOCK_SHIELD";
  }
  if (
    scenario === "FLASH_CRASH_BLACK_SWAN" ||
    tension < 10
  ) {
    return "RUIN_LOCK_SHIELD";
  }
  if (scenario === "PREDATORY_MEV_ATTACK" || (tension >= 10 && tension < 40)) {
    return "ANTI_MEV_COUNTER_SHIELD";
  }
  return "BASE_AEGIS_SHIELD";
}

/**
 * Compute Santenmoku tension + active shield morph from demo cell inputs.
 */
export function computeSantenmokuTension(
  input: TensionEngineInput,
): TensionEngineResult {
  const adaptive =
    input.adaptiveEngineEnabled === undefined
      ? true
      : Boolean(input.adaptiveEngineEnabled);
  const demo = simulateDemoCell({
    role: input.role,
    scenario: input.scenario,
    adaptiveEngineEnabled: adaptive,
  });

  const stress = SCENARIO_STRESS[input.scenario];
  let tension: number;
  if (adaptive) {
    /** High score = healthy / low ruin pressure */
    tension = clampTension(100 - stress + (demo.netYieldBps > 0 ? 4 : 0));
  } else {
    tension = clampTension(
      demo.riskStatus === "LIQUIDATED" ? 4 : 28 - stress * 0.15,
    );
  }

  const shieldMorphId = resolveShieldMorph(
    input.scenario,
    adaptive,
    tension,
  );
  const { animal, animalEmoji, tensionLabel } = resolveAnimal(tension);
  const activeTopologyNodeIds = [
    ...SCENARIO_ACTIVE_TOPOLOGY[input.scenario],
  ] as TopologyNodeId[];
  if (!adaptive && !activeTopologyNodeIds.includes("NODE_ZETA")) {
    activeTopologyNodeIds.push("NODE_ZETA");
  }

  return {
    santenmokuTension: tension,
    shieldMorphId,
    shieldMorphLabel: SHIELD_LABELS[shieldMorphId],
    animal,
    animalEmoji,
    tensionLabel,
    activeTopologyNodeIds,
    demo,
  };
}

export function getTopologyShieldCard(id: TopologyNodeId): TopologyShieldCard | undefined {
  return TOPOLOGY_SHIELD_TREE.find((c) => c.id === id);
}

export class TensionEngineService {
  compute(input: TensionEngineInput): TensionEngineResult {
    return computeSantenmokuTension(input);
  }
}
