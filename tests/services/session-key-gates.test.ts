import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSessionKeyExecutionGates,
  severSigningChannel,
  signAndExecuteOrder,
} from "../../src/services/session-key-adapter";
import * as sessionKeyEip712 from "../../src/services/session-key-adapter-lib/session-key-eip712";
import { __resetSeverGenerationForTests } from "../../src/core/signing-sever-latch";
import {
  __setSystemStateForTests,
  buildSystemState,
  readActiveSystemState,
} from "../../src/core/state";
import {
  BASE_ORDER,
  DEFAULT_SESSION_GATE_OPTS,
} from "./session-key-adapter-lib/fixtures";

afterEach(() => {
  __setSystemStateForTests(null);
  __resetSeverGenerationForTests();
  vi.restoreAllMocks();
});

describe("session-key-adapter — execution gates", () => {
  it("signAndExecuteOrder succeeds when gates pass", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    const result = await signAndExecuteOrder(BASE_ORDER, {
      systemState: state,
      ...DEFAULT_SESSION_GATE_OPTS,
    });

    expect(result.success).toBe(true);
    expect(result.signatureHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.errorReason).toBeNull();
  });

  it("dryRun skips stub signing", async () => {
    const state = buildSystemState({
      currentCri: 100,
      skipHardlockAssert: true,
    });

    const result = await signAndExecuteOrder(BASE_ORDER, {
      systemState: state,
      dryRun: true,
      ...DEFAULT_SESSION_GATE_OPTS,
    });

    expect(result).toEqual({
      success: true,
      signatureHash: null,
      errorReason: null,
    });
  });

  it("intercepts and severs when signingChannelOpen=false", async () => {
    const state = buildSystemState({
      currentCri: 100,
      skipHardlockAssert: true,
    });
    __setSystemStateForTests({ ...state, signingChannelOpen: true });

    await expect(
      signAndExecuteOrder(BASE_ORDER, {
        systemState: { ...state, signingChannelOpen: false },
        ...DEFAULT_SESSION_GATE_OPTS,
      }),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
    });

    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });

  it("intercepts when R20 locked (hardlock)", async () => {
    const state = buildSystemState({
      currentCri: 0,
      skipHardlockAssert: true,
    });

    await expect(
      signAndExecuteOrder(BASE_ORDER, {
        systemState: state,
        ...DEFAULT_SESSION_GATE_OPTS,
      }),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
      reasons: expect.arrayContaining(["R20_LOCKED=true"]),
    });

    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });

  it("intercepts when order notional exceeds dynamicMaxSlUsd", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    await expect(
      signAndExecuteOrder(
        { ...BASE_ORDER, limitPx: "500", sz: "10" },
        {
          systemState: state,
          profile: "institutional",
          leverage: 1,
          ...DEFAULT_SESSION_GATE_OPTS,
        },
      ),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
      reasons: expect.arrayContaining([
        expect.stringMatching(/ORDER_NOTIONAL=.*>dynamicMaxSlUsd=200\.00/),
      ]),
    });

    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });

  it("intercepts when open order exceeds position cap", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    await expect(
      signAndExecuteOrder(
        { ...BASE_ORDER, limitPx: "150", sz: "1" },
        {
          systemState: state,
          maxPositionUsd: 100,
          ...DEFAULT_SESSION_GATE_OPTS,
        },
      ),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
      reasons: expect.arrayContaining([
        expect.stringMatching(/POSITION_LIMIT=150\.00>maxPositionUsd=100\.00/),
      ]),
    });
  });

  it("allows reduceOnly orders above position cap", () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    expect(
      assertSessionKeyExecutionGates(
        { ...BASE_ORDER, limitPx: "150", sz: "1", reduceOnly: true },
        state,
        100,
        DEFAULT_SESSION_GATE_OPTS,
      ),
    ).toBe(150);
  });

  it("intercepts when order notional exceeds session authorization cap", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 1_000_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });
    __setSystemStateForTests({ ...state, signingChannelOpen: true });

    await expect(
      signAndExecuteOrder(
        { ...BASE_ORDER, limitPx: "6000", sz: "1" },
        { systemState: state, ...DEFAULT_SESSION_GATE_OPTS },
      ),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
      reasons: expect.arrayContaining([
        expect.stringMatching(/SESSION_CAP=6000\.00>5000/),
      ]),
    });

    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });

  it("intercepts when contractTarget is missing (FW-05)", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    await expect(
      signAndExecuteOrder(BASE_ORDER, {
        systemState: state,
        hlAction: "order",
      }),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
      reasons: expect.arrayContaining(["CONTRACT_TARGET_REQUIRED"]),
    });
  });

  it("intercepts when hlAction is outside order|cancel (FW-05)", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    await expect(
      signAndExecuteOrder(BASE_ORDER, {
        systemState: state,
        ...DEFAULT_SESSION_GATE_OPTS,
        hlAction: "withdraw" as "order",
      }),
    ).rejects.toMatchObject({
      code: "SESSION_KEY_HARDLOCK_INTERCEPTED",
      reasons: expect.arrayContaining(["HL_ACTION_INVALID"]),
    });
  });

  it("rejects in-flight sign when severGeneration bumps (FW-02)", async () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });
    __setSystemStateForTests({ ...state, signingChannelOpen: true });

    let releaseSign!: () => void;
    const signBlock = new Promise<void>((resolve) => {
      releaseSign = resolve;
    });

    vi.spyOn(sessionKeyEip712, "stubSignSessionKeyPayload").mockImplementation(async () => {
      await signBlock;
      return "0x" + "ab".repeat(32);
    });

    const signPromise = signAndExecuteOrder(BASE_ORDER, {
      systemState: state,
      ...DEFAULT_SESSION_GATE_OPTS,
    });

    await Promise.resolve();
    severSigningChannel();
    releaseSign();

    await expect(signPromise).rejects.toMatchObject({
      code: "SESSION_KEY_SEVER_RACE",
    });
    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });
});
