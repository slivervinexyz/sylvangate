import { afterEach, describe, expect, it } from "vitest";
import { checkSoilResistance } from "../src/services/risk-control";
import {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
  ARBITRUM_SEQUENCER_UPTIME_FEED,
  evaluateSequencerProbe,
  isSequencerSafe,
  getSequencerUnsafeReason,
  refreshSequencerGuard,
  SEQUENCER_GUARD_CACHE_MAX_AGE_MS,
} from "../src/services/risk/sequencer-guard";

const OFFICIAL_ARBITRUM_SEQUENCER_FEED =
  "0xFdB631F5EE196F0ed6FAa767959853A9F217697D" as const;

afterEach(() => {
  __resetSequencerGuardCacheForTests();
});

describe("sequencer-guard", () => {
  it("ARBITRUM_SEQUENCER_UPTIME_FEED matches official Arbitrum One address", () => {
    expect(ARBITRUM_SEQUENCER_UPTIME_FEED).toBe(OFFICIAL_ARBITRUM_SEQUENCER_FEED);
  });

  it("refreshSequencerGuard eth_call targets official sequencer feed", async () => {
    let capturedBody: string | undefined;
    await refreshSequencerGuard({
      fetchFn: async (_url, init) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ result: "0x" + "0".repeat(256) }), {
          status: 200,
        });
      },
    });
    const payload = JSON.parse(capturedBody!) as {
      params: [{ to: string; data: string }, string];
    };
    expect(payload.params[0].to).toBe(OFFICIAL_ARBITRUM_SEQUENCER_FEED);
  });

  it("evaluateSequencerProbe — down when answer !== 0", () => {
    const v = evaluateSequencerProbe(1, 1_000, 2_000);
    expect(v.safe).toBe(false);
    expect(v.reason).toBe("ARBITRUM_SEQUENCER_DOWN");
  });

  it("evaluateSequencerProbe — grace window blocks < 600s", () => {
    const now = 5_000;
    const v = evaluateSequencerProbe(0, now - 300, now);
    expect(v.safe).toBe(false);
    expect(v.reason).toMatch(/GRACE/);
  });

  it("evaluateSequencerProbe — safe after grace elapsed", () => {
    const now = 10_000;
    const v = evaluateSequencerProbe(0, now - 900, now);
    expect(v.safe).toBe(true);
  });

  it("isSequencerSafe fail-closed without cache", () => {
    expect(isSequencerSafe()).toBe(false);
    expect(getSequencerUnsafeReason()).toBe("ARBITRUM_SEQUENCER_PROBE_MISSING");
  });

  it("isSequencerSafe fail-closed when cache stale >30s", () => {
    __setSequencerProbeForTests({
      answer: 0,
      startedAtSec: 0,
      updatedAtSec: 0,
      fetchedAtMs: Date.now() - SEQUENCER_GUARD_CACHE_MAX_AGE_MS - 1,
      safe: true,
      reason: null,
    });
    expect(isSequencerSafe()).toBe(false);
    expect(getSequencerUnsafeReason()).toBe("ARBITRUM_SEQUENCER_PROBE_STALE");
  });

  it("refreshSequencerGuard fail-closed on RPC error", async () => {
    const state = await refreshSequencerGuard({
      fetchFn: async () => new Response("down", { status: 503 }),
    });
    expect(state.safe).toBe(false);
    expect(isSequencerSafe()).toBe(false);
    expect(getSequencerUnsafeReason()).toMatch(/ARBITRUM_SEQUENCER_RPC_FAIL/);
  });

  it("isSequencerSafe trips checkSoilResistance when cache unsafe", () => {
    __setSequencerProbeForTests({
      answer: 1,
      startedAtSec: 0,
      updatedAtSec: 0,
      fetchedAtMs: Date.now(),
      safe: false,
      reason: "ARBITRUM_SEQUENCER_DOWN",
    });
    expect(isSequencerSafe()).toBe(false);
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3500,
      depthUsd: 200_000,
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons).toContain("ARBITRUM_SEQUENCER_DOWN");
  });
});
