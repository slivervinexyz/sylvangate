import { describe, expect, it } from "vitest";
import { resolveSanmHudFrame, isEvacuationTriggered } from "../../src/lib/gui-bridge/sanm-hud-frame";

describe("NirvanaEvacuationShield data plane", () => {
  it("mockSanmHUD default step stays nominal (standby — no evacuation overlay)", () => {
    const frame = resolveSanmHudFrame();
    expect(frame.nirvana_rwa_evacuation_triggered).toBe(false);
    expect(isEvacuationTriggered(frame)).toBe(false);
    expect(frame.minute).toBe(0);
  });

  it("sanm_step query index 2 triggers evacuation frame", () => {
    const frame = resolveSanmHudFrame(2);
    expect(frame.minute).toBe(16);
    expect(frame.nirvana_rwa_evacuation_triggered).toBe(true);
  });

  it("nominal step does not trigger evacuation", () => {
    const frame = resolveSanmHudFrame(0);
    expect(frame.nirvana_rwa_evacuation_triggered).toBe(false);
    expect(isEvacuationTriggered(frame)).toBe(false);
  });
});
