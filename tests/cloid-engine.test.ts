import { afterEach, describe, expect, it } from "vitest";
import {
  CLOID_HEX_BODY_LENGTH,
  CLOID_HEX_PREFIX,
  CLOID_STRATEGY_PREFIX,
  CLOID_TAGGED_PREFIX,
  buildCloidPayload,
  formatCloidTagged,
  generateCloid,
  isValidCloidHex,
  isValidCloidTagged,
  parseCloidHex,
  payloadToHex,
} from "../src/services/cloid-generator";
import {
  CLOID_KV_KEY_PREFIX,
  CLOID_KV_TTL_SECONDS,
  ROOT14_REPLAY_CODE,
  assertCloidNotReplayed,
  claimCloidAntiReplay,
  isCloidReplayed,
  registerCloid,
  resetCloidReplayCache,
} from "../src/services/cloid-validator";

function createMockKv(initial = new Map<string, string>()): KVNamespace {
  const store = new Map(initial);
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => null,
  } as KVNamespace;
}

describe("CLOID generator", () => {
  const fixedNow = new Date("2026-09-11T12:34:56.789Z");
  const fixedNonce = 0xdeadbeef;

  it("generates 128-bit hex CLOIDs with 0x prefix and embedded STM strategy", () => {
    const cloid = generateCloid({ now: fixedNow, nonce: fixedNonce });

    expect(cloid.hex.startsWith(CLOID_HEX_PREFIX)).toBe(true);
    expect(cloid.hex.length).toBe(CLOID_HEX_PREFIX.length + CLOID_HEX_BODY_LENGTH);
    expect(isValidCloidHex(cloid.hex)).toBe(true);
    expect(cloid.hex.startsWith(`${CLOID_HEX_PREFIX}53544d`)).toBe(true);

    const parsed = parseCloidHex(cloid.hex);
    expect(parsed?.strategy).toBe(CLOID_STRATEGY_PREFIX);
    expect(parsed?.timestampSec).toBe(Math.floor(fixedNow.getTime() / 1000));
    expect(parsed?.nonce).toBe(fixedNonce);
  });

  it("generates tagged STM- CLOIDs with UTC timestamp and deterministic nonce", () => {
    const cloid = generateCloid({ now: fixedNow, nonce: fixedNonce });

    expect(cloid.tagged.startsWith(CLOID_TAGGED_PREFIX)).toBe(true);
    expect(isValidCloidTagged(cloid.tagged)).toBe(true);
    expect(cloid.tagged).toBe(
      formatCloidTagged({
        strategy: CLOID_STRATEGY_PREFIX,
        now: fixedNow,
        nonce: fixedNonce,
      }),
    );
  });

  it("builds deterministic payloads from fixed inputs", () => {
    const payload = buildCloidPayload({
      strategy: CLOID_STRATEGY_PREFIX,
      timestampSec: 1_700_000_000,
      nonce: 42,
      tail: new Uint8Array([1, 2, 3, 4, 5]),
    });
    expect(payloadToHex(payload)).toBe(
      "0x53544d6553f1000000002a0102030405",
    );
  });

  it("rejects invalid hex and tagged formats", () => {
    expect(isValidCloidHex("STM-20260724123456-deadbee0")).toBe(false);
    expect(isValidCloidHex("0xabc")).toBe(false);
    expect(isValidCloidTagged("0x53544d0000000065280000002a0102030405")).toBe(
      false,
    );
    expect(parseCloidHex("not-a-cloid")).toBeNull();
  });
});

describe("CLOID anti-replay validator", () => {
  afterEach(() => {
    resetCloidReplayCache();
  });

  it("returns false on first pass and true on duplicate in memory cache", async () => {
    const cloid = generateCloid({
      now: new Date("2026-09-11T12:00:00.000Z"),
      nonce: 1,
    }).hex;

    expect(await isCloidReplayed(cloid)).toBe(false);
    await registerCloid(cloid);
    expect(await isCloidReplayed(cloid)).toBe(true);
  });

  it("claimCloidAntiReplay blocks duplicates with ROOT14 trigger code", async () => {
    const cloid = generateCloid({
      now: new Date("2026-09-11T12:00:00.000Z"),
      nonce: 2,
    }).hex;

    const first = await claimCloidAntiReplay(cloid);
    expect(first.replayed).toBe(false);
    expect(first.code).toBeUndefined();

    const second = await claimCloidAntiReplay(cloid);
    expect(second.replayed).toBe(true);
    expect(second.code).toBe(ROOT14_REPLAY_CODE);
    expect(second.reason).toMatch(/REPLAY_ATTACK_DETECTED/);
  });

  it("falls back to KV when memory cache is cold", async () => {
    const cloid = generateCloid({
      now: new Date("2026-09-11T12:00:00.000Z"),
      nonce: 3,
    }).hex;
    const kv = createMockKv(
      new Map([[`${CLOID_KV_KEY_PREFIX}${cloid.toLowerCase()}`, "1"]]),
    );

    expect(await isCloidReplayed(cloid, kv)).toBe(true);
  });

  it("registers CLOIDs into KV with 24h expiration TTL", async () => {
    const cloid = generateCloid({
      now: new Date("2026-09-11T12:00:00.000Z"),
      nonce: 4,
    }).hex;
    const store = new Map<string, string>();
    const putCalls: Array<{ key: string; ttl?: number }> = [];
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (
        key: string,
        value: string,
        options?: { expirationTtl?: number },
      ) => {
        store.set(key, value);
        putCalls.push({ key, ttl: options?.expirationTtl });
      },
      delete: async (key: string) => {
        store.delete(key);
      },
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      getWithMetadata: async () => null,
    } as KVNamespace;

    await registerCloid(cloid, kv);

    expect(putCalls).toEqual([
      {
        key: `${CLOID_KV_KEY_PREFIX}${cloid.toLowerCase()}`,
        ttl: CLOID_KV_TTL_SECONDS,
      },
    ]);
    expect(await isCloidReplayed(cloid, kv)).toBe(true);
  });

  it("assertCloidNotReplayed throws on duplicate CLOID", async () => {
    const cloid = generateCloid({
      now: new Date("2026-09-11T12:00:00.000Z"),
      nonce: 5,
    }).hex;

    await assertCloidNotReplayed(cloid);
    await expect(assertCloidNotReplayed(cloid)).rejects.toMatchObject({
      code: ROOT14_REPLAY_CODE,
      cloid,
    });
  });
});
