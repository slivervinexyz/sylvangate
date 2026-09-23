import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindProtocolMaskGlobalState,
  bindProtocolMaskKvPort,
  commitProtocolMaskScratch,
  mergeProtocolMaskIntoTripFlags,
  mergeProtocolMaskLocal,
  prefetchProtocolMaskKv,
  readProtocolMaskSync,
  scheduleProtocolMaskKvWrite,
  seedProtocolMaskScratch,
  __resetProtocolMaskSyncForTests,
} from "../../src/core/protocol-mask-sync";

afterEach(() => {
  __resetProtocolMaskSyncForTests();
});

describe("protocol-mask-sync", () => {
  it("readProtocolMaskSync is O(1) with zero initial mask", () => {
    expect(readProtocolMaskSync()).toBe(0);
  });

  it("merges global state adapter on hot-path read", () => {
    const reservedAbiBit4 = 1 << 4; // RESERVED_ABI_V2 hole — arbitrary mask probe
    bindProtocolMaskGlobalState(() => reservedAbiBit4);
    expect(readProtocolMaskSync()).toBe(reservedAbiBit4);
    expect(mergeProtocolMaskLocal(1 << 2)).toBe(reservedAbiBit4 | (1 << 2));
  });

  it("prefetchProtocolMaskKv warms isolate cache from KV port", async () => {
    const get = vi.fn().mockResolvedValue(
      JSON.stringify({ version: 1, mask: 1 << 18, savedAt: "2026-09-07T00:00:00.000Z" }),
    );
    bindProtocolMaskKvPort({ getMaskRecord: get, putMaskRecord: vi.fn() });
    await prefetchProtocolMaskKv();
    expect(readProtocolMaskSync()).toBe(1 << 18);
  });

  it("scheduleProtocolMaskKvWrite updates cache and fire-and-forgets put", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    bindProtocolMaskKvPort({
      getMaskRecord: vi.fn().mockResolvedValue(null),
      putMaskRecord: put,
    });
    scheduleProtocolMaskKvWrite(1 << 3);
    expect(readProtocolMaskSync()).toBe(1 << 3);
    await Promise.resolve();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("seed and commit scratch preserves hot-path semantics", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    bindProtocolMaskKvPort({
      getMaskRecord: vi.fn().mockResolvedValue(
        JSON.stringify({ version: 1, mask: 1 << 1, savedAt: "2026-09-07T00:00:00.000Z" }),
      ),
      putMaskRecord: put,
    });
    await prefetchProtocolMaskKv();
    const scratch = { protocolMask: 0 };
    const before = seedProtocolMaskScratch(scratch);
    expect(before).toBe(1 << 1);
    const reservedAbiBit5 = 1 << 5; // RESERVED_ABI_V2 hole — arbitrary mask probe
    scratch.protocolMask |= reservedAbiBit5;
    commitProtocolMaskScratch(scratch, before);
    expect(scratch.protocolMask).toBe((1 << 1) | reservedAbiBit5);
    expect(put).toHaveBeenCalled();
  });

  it("mergeProtocolMaskIntoTripFlags sets protocol trip bit", () => {
    expect(mergeProtocolMaskIntoTripFlags(0, 1 << 18)).toBe(8);
    expect(mergeProtocolMaskIntoTripFlags(2, 0)).toBe(2);
  });
});
