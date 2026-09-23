import { describe, expect, it } from "vitest";
import { simulateTransactionIntent } from "../../src/services/sandbox";
import { buildSystemState } from "../../src/core/state";

const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

const TRIPPED_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 0,
  dydxPerp: 0,
};

describe("simulateTransactionIntent", () => {
  it("passes HL zero-key dry-run with full gate path", () => {
    const report = simulateTransactionIntent(
      {
        venue: "HL",
        amountUsd: 50,
        soil: PASSING_SOIL,
      },
      buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
    );

    expect(report.isAllowed).toBe(true);
    expect(report.zeroKeyDryRun).toBe(true);
    expect(report.passedGates).toEqual([
      "R20_LOCK",
      "ROOT_PROTECTION",
      "FOOL_PROOF_GUARD",
      "SOIL_RESISTANCE",
      "HL_DRY_RUN",
    ]);
    expect(report.failedGate).toBeUndefined();
    expect(report.simulatedExecutionTimeMs).toBeGreaterThanOrEqual(0);
    expect(report.executionPath.at(-1)).toBe("sandbox:complete");
  });

  it("blocks at R20 with empty passed gates", () => {
    const report = simulateTransactionIntent(
      {
        venue: "HL",
        amountUsd: 25,
        soil: PASSING_SOIL,
      },
      {
        hardlock: true,
        currentCri: 0,
        signingChannelOpen: false,
      },
    );

    expect(report.isAllowed).toBe(false);
    expect(report.failedGate).toBe("R20_LOCK");
    expect(report.passedGates).toEqual([]);
    expect(report.suggestedHttpCode).toBe(403);
  });

  it("blocks at soil after passing R20 and root protection", () => {
    const report = simulateTransactionIntent(
      {
        venue: "HL",
        amountUsd: 25,
        soil: TRIPPED_SOIL,
      },
      buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
    );

    expect(report.isAllowed).toBe(false);
    expect(report.failedGate).toBe("SOIL_RESISTANCE");
    expect(report.passedGates).toEqual(["R20_LOCK", "ROOT_PROTECTION", "FOOL_PROOF_GUARD"]);
    expect(report.suggestedHttpCode).toBe(422);
    expect(report.executionPath).toContain("gate:SOIL_RESISTANCE:fail");
  });
});
