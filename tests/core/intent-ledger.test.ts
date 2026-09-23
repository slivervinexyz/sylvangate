import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearIntentLedgerForTests,
  abortIntent,
  commitIntent,
  createCrossLegIntent,
  prepareIntent,
  R20_FLATTEN_FAILED,
  type FlattenAction,
} from "../../src/core/intent-ledger";
import {
  __resetCircuitBreakerSeverForTests,
  readActiveCircuitBreakerSeverTarget,
} from "../../src/services/root-protection-lib/circuit-breaker-sever";
import { __resetFlattenHardlockKvForTests } from "../../src/core/intent-ledger/flatten-hardlock";

const HL_LEG = { venue: "HL" as const, side: "SHORT" as const, sizeUsd: 100, symbol: "ETH" };
const POLY_LEG = { venue: "POLYMARKET" as const, side: "BUY" as const, sizeUsd: 25 };

beforeEach(() => {
  __clearIntentLedgerForTests();
  __resetCircuitBreakerSeverForTests();
  __resetFlattenHardlockKvForTests();
});

describe("intent-ledger 2PC", () => {
  it("prepares both legs and transitions to PREPARED", async () => {
    createCrossLegIntent({ id: "intent-1", legs: [HL_LEG, POLY_LEG] });
    const result = await prepareIntent("intent-1");

    expect(result.ok).toBe(true);
    expect(result.intent.phase).toBe("PREPARED");
    expect(result.intent.legResults).toHaveLength(2);
    expect(result.intent.legResults.every((r) => r.ok)).toBe(true);
  });

  it("commits after successful prepare", async () => {
    createCrossLegIntent({ id: "intent-2", legs: [HL_LEG, POLY_LEG] });
    await prepareIntent("intent-2");
    const result = await commitIntent("intent-2");

    expect(result.ok).toBe(true);
    expect(result.intent.phase).toBe("COMMITTED");
  });

  it("aborts and flattens when one leg prepare fails (single-leg guard)", async () => {
    const flattenSpy = vi.fn(async (_action: FlattenAction) => ({ ok: true }));

    createCrossLegIntent({ id: "intent-3", legs: [HL_LEG, POLY_LEG] });
    const result = await prepareIntent("intent-3", {
      prepareLeg: async (leg, index) => {
        if (index === 1) return { legIndex: index, ok: false, reason: "POLY_DEPTH_FAIL" };
        return { legIndex: index, ok: true, filledUsd: leg.sizeUsd };
      },
      flattenLeg: flattenSpy,
    });

    expect(result.ok).toBe(false);
    expect(result.intent.phase).toBe("ABORTED");
    expect(result.intent.abortReason).toContain("POLY_DEPTH_FAIL");
    expect(result.intent.flattenActions).toHaveLength(1);
    expect(result.intent.flattenActions[0]?.venue).toBe("HL");
    expect(result.intent.flattenActions[0]?.reduceOnly).toBe(true);
    expect(flattenSpy).toHaveBeenCalledTimes(1);
  });

  it("aborts on commit failure and enqueues flatten for all legs", async () => {
    const flattenSpy = vi.fn(async () => ({ ok: true }));

    createCrossLegIntent({ id: "intent-4", legs: [HL_LEG, POLY_LEG] });
    await prepareIntent("intent-4");
    const result = await commitIntent("intent-4", {
      commitLeg: async (_leg, index) =>
        index === 0 ? { ok: true } : { ok: false, reason: "POLY_COMMIT_FAIL" },
      flattenLeg: flattenSpy,
    });

    expect(result.ok).toBe(false);
    expect(result.intent.phase).toBe("ABORTED");
    expect(result.intent.flattenActions).toHaveLength(2);
    expect(flattenSpy).toHaveBeenCalledTimes(2);
  });

  it("explicit abort from PENDING does not require prior prepare", async () => {
    createCrossLegIntent({ id: "intent-5", legs: [HL_LEG, POLY_LEG] });
    const result = await abortIntent("intent-5", "OPERATOR_CANCEL");

    expect(result.ok).toBe(true);
    expect(result.intent.phase).toBe("ABORTED");
    expect(result.intent.abortReason).toBe("OPERATOR_CANCEL");
  });

  it("triggers R20 hardlock when compensating flatten fails on commit rollback", async () => {
    const flattenSpy = vi.fn(async () => ({ ok: false, reason: "HL_FLATTEN_REJECTED" }));

    createCrossLegIntent({ id: "intent-6", legs: [HL_LEG, POLY_LEG] });
    await prepareIntent("intent-6");
    const result = await commitIntent("intent-6", {
      commitLeg: async (_leg, index) =>
        index === 0 ? { ok: true } : { ok: false, reason: "POLY_COMMIT_FAIL" },
      flattenLeg: flattenSpy,
    });

    expect(result.ok).toBe(false);
    expect(result.intent.hardlocked).toBe(true);
    expect(result.intent.abortReason).toContain(R20_FLATTEN_FAILED);
    expect(readActiveCircuitBreakerSeverTarget()).toBe("R20");
    expect(flattenSpy).toHaveBeenCalledTimes(2);
  });

  it("triggers R20 hardlock when compensating flatten fails on prepare rollback", async () => {
    const flattenSpy = vi.fn(async () => ({ ok: false, reason: "HL_FLATTEN_REJECTED" }));

    createCrossLegIntent({ id: "intent-7", legs: [HL_LEG, POLY_LEG] });
    const result = await prepareIntent("intent-7", {
      prepareLeg: async (leg, index) => {
        if (index === 1) return { legIndex: index, ok: false, reason: "POLY_DEPTH_FAIL" };
        return { legIndex: index, ok: true, filledUsd: leg.sizeUsd };
      },
      flattenLeg: flattenSpy,
    });

    expect(result.ok).toBe(false);
    expect(result.intent.hardlocked).toBe(true);
    expect(result.intent.abortReason).toContain(R20_FLATTEN_FAILED);
    expect(readActiveCircuitBreakerSeverTarget()).toBe("R20");
    expect(flattenSpy).toHaveBeenCalledTimes(1);
  });
});
