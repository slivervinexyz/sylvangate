/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 *
 * SliverVine ExoMesh B2B decorator — universal agent hook wrapper. Routes intents through
 * ReflexCore (SSRC) `checkSoilResistance()` before
 * EIP-712 signing or Bundler dispatch (0-Gas fail-closed on trip).
 */
import { MAX_ATTEMPTS_EXCEEDED_SEVERED } from "../core/intent-mandate";
import { checkSoilResistance, type SoilResistanceInput } from "../services/risk-control";

export type ExoMeshShieldIntent = SoilResistanceInput & { agentId?: string };

const COOLDOWN_MS = 60_000;
const activeCooldowns = new Map<string, number>();

export function __clearExoMeshCooldownsForTests(): void {
  activeCooldowns.clear();
}

function resolveAgentId(intent: ExoMeshShieldIntent): string {
  return intent.agentId?.trim() || "default-agent";
}

function defaultAgentSuffix(intent: ExoMeshShieldIntent): string {
  if (intent.agentId?.trim() || process.env.VITEST === "true") return "";
  return " [agentId=default-agent]";
}

function activateCooldown(agentId: string): void {
  activeCooldowns.set(agentId, Date.now() + COOLDOWN_MS);
}

function assertCooldownClear(agentId: string): void {
  const cooldownUntil = activeCooldowns.get(agentId);
  if (!cooldownUntil) return;
  const now = Date.now();
  if (now < cooldownUntil) {
    const remainingSec = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
    throw new Error(
      `[ExoMesh Back-off] MANDATORY_COOLDOWN_ACTIVE: Agent '${agentId}' tripped soil fuse recently. DO NOT RETRY or invoke LLM inference for the next ${remainingSec} seconds to prevent token burn and RPC rate limits.`,
    );
  }
  activeCooldowns.delete(agentId);
}

function isCooldownTrigger(message: string): boolean {
  const upper = message.toUpperCase();
  return (
    upper.includes("SOIL_RESISTANCE_TRIP") ||
    upper.includes("FAIL_CLOSED") ||
    upper.includes("[EXOMESH SHIELD TRIP]") ||
    upper.includes("[EXOMESH TRIP]") ||
    upper.includes("[SSRC TRIP]")
  );
}

/** ExoMesh B2B soil-gate decorator (SSRC-backed). */
export function withExoMeshShield<T extends ExoMeshShieldIntent>(
  executionFn: (intent: T) => Promise<unknown>,
) {
  return async function shielded(intent: T) {
    const agentId = resolveAgentId(intent);
    const agentSuffix = defaultAgentSuffix(intent);
    assertCooldownClear(agentId);

    const soilResult = checkSoilResistance({ ...intent, agentId });
    if (!soilResult.ok) {
      activateCooldown(agentId);
      const reason = soilResult.reasons.join("; ") || "SOIL_RESISTANCE_TRIP";
      if (soilResult.reasons.some((r) => r.startsWith(MAX_ATTEMPTS_EXCEEDED_SEVERED))) {
        throw new Error(`[ExoMesh Trip] ${MAX_ATTEMPTS_EXCEEDED_SEVERED}: ${reason}${agentSuffix}`);
      }
      throw new Error(`[ExoMesh Trip] Execution blocked pre-broadcast: ${reason}${agentSuffix}`);
    }

    try {
      return await executionFn(intent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isCooldownTrigger(message)) activateCooldown(agentId);
      throw err;
    }
  };
}
