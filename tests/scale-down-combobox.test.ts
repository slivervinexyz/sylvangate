import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCALE_DOWN_COMBO,
  formatActiveOperators,
  formatMasterPresetLabel,
  SCALE_DOWN_COMBO_PRESETS,
  SHIELD_BREAKDOWN_BY_VERSION,
} from "../src/lib/gui-bridge/scale-down-presets";

describe("ScaleDownCombobox presets", () => {
  it("exposes three Grant-safe combo bundles", () => {
    expect(Object.keys(SCALE_DOWN_COMBO_PRESETS)).toEqual([
      "COMBO_A",
      "COMBO_B",
      "COMBO_C",
    ]);
  });

  it("defaults to Light Shield preset", () => {
    expect(DEFAULT_SCALE_DOWN_COMBO).toBe("COMBO_A");
    expect(SCALE_DOWN_COMBO_PRESETS.COMBO_A.items).toContain(
      "Toxic-Fill & Stale-Book Mitigation",
    );
  });

  it("formats collapsed operator strip with plus separators", () => {
    expect(formatActiveOperators(SCALE_DOWN_COMBO_PRESETS.COMBO_B.items)).toBe(
      "Soil Resistance + Dynamic Fee Rebate + Saga Circuit",
    );
  });

  it("builds cumulative stacked tier labels per active preset", () => {
    expect(formatMasterPresetLabel("COMBO_A", "COMBO_A")).toBe(
      "🔵 v0.8 GMX Blue Shield · Tier 1 Base Depth (6/6 Active) ℹ️",
    );
    expect(formatMasterPresetLabel("COMBO_B", "COMBO_A")).toBe(
      "🟡 v1.0 Institutional · Tier 1+2 Circuit Breakers (12/12 Target) 🔒",
    );
    expect(formatMasterPresetLabel("COMBO_B", "COMBO_B")).toBe(
      "🟡 v1.0 Institutional · Tier 1+2 Circuit Breakers (12/12 Active) ℹ️",
    );
    expect(formatMasterPresetLabel("COMBO_C", "COMBO_C")).toBe(
      "🔒 v1.5 Black Swan · Tier 1+2+3 Counter-MEV (20/20 Active) ℹ️",
    );
  });

  it("includes Black Swan auto-flatten in extreme preset", () => {
    expect(SCALE_DOWN_COMBO_PRESETS.COMBO_C.items.join(" ")).toMatch(
      /Auto-Flatten/,
    );
  });

  it("labels UM-03 as v1.5 Counter-MEV simulation in shield breakdown", () => {
    const um03 = SHIELD_BREAKDOWN_BY_VERSION["v1.5"].find((line) =>
      line.label.includes("UM-03"),
    );
    expect(um03?.detail).toBe("[ V1.5 Counter-MEV Simulation ]");
  });

  it("tags BO-02 as v1.0 reserved in shield breakdown", () => {
    const bo02 = SHIELD_BREAKDOWN_BY_VERSION["v1.0"].find((line) =>
      line.label.includes("BO-02"),
    );
    expect(bo02?.detail).toBe("[V1.0 RESERVED]");
  });
});
