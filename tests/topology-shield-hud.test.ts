/**
 * Topology Shield Tree HUD — password gate, topology map, tension engine linkage.
 */
import { describe, expect, it } from "vitest";
import {
  TOPOLOGY_SHIELD_TREE,
  computeSantenmokuTension,
  getTopologyShieldCard,
  verifyInternalHudPassword,
  INTERNAL_HUD_PASSWORD,
} from "../src/services/tension-engine-service";

describe("Internal HUD password gate", () => {
  it("accepts only 0xwallet", () => {
    expect(INTERNAL_HUD_PASSWORD).toBe("0xwallet");
    expect(verifyInternalHudPassword("0xwallet")).toBe(true);
    expect(verifyInternalHudPassword("wrong")).toBe(false);
    expect(verifyInternalHudPassword("")).toBe(false);
  });
});

describe("Topology shield tree", () => {
  it("maps exactly 8 topology node cards", () => {
    expect(TOPOLOGY_SHIELD_TREE).toHaveLength(8);
    const ids = TOPOLOGY_SHIELD_TREE.map((c) => c.id);
    expect(ids).toEqual([
      "NODE_ALPHA",
      "NODE_SIGMA",
      "NODE_DELTA",
      "NODE_THETA",
      "NODE_OMEGA",
      "NODE_KAPPA",
      "NODE_LAMBDA",
      "NODE_ZETA",
    ]);
  });

  it("locks W40 HTCA on NODE_ZETA as Phase 3 roadmap shield", () => {
    const zeta = getTopologyShieldCard("NODE_ZETA");
    expect(zeta).toBeDefined();
    const w40 = zeta!.weapons.find((w) => w.id === "W40");
    expect(w40?.locked).toBe(true);
    expect(w40?.defaultEnabled).toBe(false);
    expect(w40?.label).toContain("W40 HTCA");
    expect(w40?.label).toContain("Phase 3");
    expect(w40?.label).toContain("Locked Shield");
  });
});

describe("Tension engine ↔ demo simulator linkage", () => {
  it("ON flash-crash → high lock pressure + Ruin Lock + active NODE_THETA/NODE_DELTA", () => {
    const r = computeSantenmokuTension({
      role: "INSTITUTION",
      scenario: "FLASH_CRASH_BLACK_SWAN",
      adaptiveEngineEnabled: true,
    });
    expect(r.santenmokuTension).toBeGreaterThanOrEqual(0);
    expect(r.santenmokuTension).toBeLessThanOrEqual(100);
    expect(r.shieldMorphId).toBe("RUIN_LOCK_SHIELD");
    expect(r.shieldMorphLabel).toBe("Ruin Lock Shield");
    expect(r.demo.principalProtected).toBe(true);
    expect(r.activeTopologyNodeIds).toEqual(
      expect.arrayContaining(["NODE_THETA", "NODE_DELTA"]),
    );
    expect(r.animalEmoji).toMatch(/🦔|🦅|🐻|🐱/);
  });

  it("ON ranging → Base Aegis + calm band", () => {
    const r = computeSantenmokuTension({
      role: "RETAIL",
      scenario: "NORMAL_RANGING",
      adaptiveEngineEnabled: true,
    });
    expect(r.santenmokuTension).toBeGreaterThanOrEqual(80);
    expect(r.shieldMorphId).toBe("BASE_AEGIS_SHIELD");
    expect(r.tensionLabel).toBe("Calm");
    expect(r.animalEmoji).toBe("🐱");
  });

  it("ON MEV → Anti-MEV Counter Shield + NODE_KAPPA active", () => {
    const r = computeSantenmokuTension({
      role: "PRO_TRADER",
      scenario: "PREDATORY_MEV_ATTACK",
      adaptiveEngineEnabled: true,
    });
    expect(r.shieldMorphId).toBe("ANTI_MEV_COUNTER_SHIELD");
    expect(r.activeTopologyNodeIds).toContain("NODE_KAPPA");
  });

  it("OFF extreme → unprotected / ruin + worse demo metrics than ON", () => {
    const on = computeSantenmokuTension({
      role: "DAPP_INTEGRATOR",
      scenario: "LIQUIDITY_HOLE_VACUUM",
      adaptiveEngineEnabled: true,
    });
    const off = computeSantenmokuTension({
      role: "DAPP_INTEGRATOR",
      scenario: "LIQUIDITY_HOLE_VACUUM",
      adaptiveEngineEnabled: false,
    });
    expect(off.santenmokuTension).toBeLessThan(on.santenmokuTension);
    expect(off.demo.slippageBps).toBeGreaterThan(on.demo.slippageBps);
    expect(off.shieldMorphId).toBe("RUIN_LOCK_SHIELD");
    expect(off.demo.principalProtected).toBe(false);
  });
});
