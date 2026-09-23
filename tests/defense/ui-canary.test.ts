import { afterEach, describe, expect, it } from "vitest";
import {
  __setHudCanaryEnvForTests,
  assertUiWorkerHandshake,
  buildUiHandshakeHeaders,
  computeRuntimeCanaryHash,
  generateCanvasWatermarkPayload,
  HUD_CANARY_EXPECTED,
  isHudCanaryAuthenticated,
  resolveUiStreamState,
  RUNTIME_CANARY_SEED,
  RUNTIME_INTEGRITY_HEADER,
  UI_LOCKED_MESSAGE,
} from "../../src/services/defense/ui-canary";

const HUD_CANARY_ENV = {
  NEXT_PUBLIC_HUD_CANARY: HUD_CANARY_EXPECTED,
} as const;

afterEach(() => {
  __setHudCanaryEnvForTests(undefined);
});

describe("RuntimeCanary ui-canary HUD handshake", () => {
  it("authenticates with NEXT_PUBLIC_HUD_CANARY=santenmoku", () => {
    __setHudCanaryEnvForTests({ ...HUD_CANARY_ENV });
    expect(isHudCanaryAuthenticated()).toBe(true);
    expect(resolveUiStreamState()).toBe("CONNECTED");
    expect(assertUiWorkerHandshake()).toEqual({ ok: true });
    expect(buildUiHandshakeHeaders()).toMatchObject({
      "X-Santenmoku-Canary": HUD_CANARY_EXPECTED,
      [RUNTIME_INTEGRITY_HEADER]: computeRuntimeCanaryHash(),
    });
  });

  it("locks UI stream when canary token is invalid", () => {
    __setHudCanaryEnvForTests({ NEXT_PUBLIC_HUD_CANARY: "wrong" });
    expect(isHudCanaryAuthenticated()).toBe(false);
    expect(resolveUiStreamState()).toBe("DISCONNECTED_LOCKED");
    expect(assertUiWorkerHandshake()).toEqual({
      ok: false,
      message: UI_LOCKED_MESSAGE,
    });
    expect(buildUiHandshakeHeaders()).toMatchObject({
      "X-Santenmoku-Canary": HUD_CANARY_EXPECTED,
    });
  });

  it("falls back to santenmoku when NEXT_PUBLIC_HUD_CANARY is unset", () => {
    __setHudCanaryEnvForTests({});
    expect(isHudCanaryAuthenticated()).toBe(true);
    expect(resolveUiStreamState()).toBe("CONNECTED");
    expect(assertUiWorkerHandshake()).toEqual({ ok: true });
  });

  it("generates stable Canvas/WebGL watermark payload", () => {
    const payload = generateCanvasWatermarkPayload();
    expect(payload.seed).toBe(RUNTIME_CANARY_SEED);
    expect(payload.hash).toMatch(/^ri-[0-9a-f]{8}$/);
    expect(payload.webglHint).toContain("webgl-ri-");
  });
});
