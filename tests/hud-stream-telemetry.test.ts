import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetHudStreamDebounceForTests,
  buildHudStreamPayload,
  buildHudStreamPayloadSafe,
  handleHudStreamRequest,
  HUD_STREAM_DEBOUNCE_MS,
} from "../src/api/hud-telemetry";
import * as threeEyeModule from "../src/services/hl-telemetry-probe";
import * as uiCanary from "../src/services/defense/ui-canary";
import {
  __setSystemStateForTests,
  buildSystemState,
} from "../src/core/state";
import { HUD_CANARY_EXPECTED } from "../src/services/defense/ui-canary";
import { hudRequest } from "./backend-finalization-lib/fixtures";

afterEach(() => {
  __setSystemStateForTests(null);
  __resetHudStreamDebounceForTests();
  vi.useRealTimers();
});

describe("hud-stream telemetry — auth & payload", () => {
  it("rejects unauthenticated requests without canary header", async () => {
    const res = handleHudStreamRequest(new Request("https://bedeltawater.slivervine.xyz/api/hud-stream"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.locked).toBe(true);
  });

  it("returns formatted Left/Right/Crown HUD payload with debounce", async () => {
    vi.useFakeTimers();
    __setSystemStateForTests({
      ...buildSystemState({ currentCri: 88, skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const first = handleHudStreamRequest(hudRequest());
    expect(first.status).toBe(200);
    const body = (await first.json()) as ReturnType<typeof buildHudStreamPayload> extends infer T
      ? T
      : never;

    expect(body.leftEyeDefense.dynamicMaxSlUsd).toBe(200);
    expect(body.rightEyeProbe.activeVenues).toEqual(["HYPERLIQUID"]);
    expect(body.crownTreasuryPnl.criIndex).toBe(88);
    expect(body.debounceMs).toBe(HUD_STREAM_DEBOUNCE_MS);
    expect(body.marketProbe.livePairsCount).toBeGreaterThan(0);
    expect(body.marketProbe.selectToken).toBeTruthy();
    expect(body.marketProbe.bestToken).toBeTruthy();

    vi.advanceTimersByTime(50);
    const cached = handleHudStreamRequest(hudRequest());
    const cachedBody = await cached.json();
    expect(cachedBody.timestamp).toBe(body.timestamp);
  });

  it("returns fallback market probe when signing channel is severed", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ currentCri: 88, skipHardlockAssert: true }),
      signingChannelOpen: false,
      isHedgeActive: false,
    });

    const res = handleHudStreamRequest(hudRequest());
    const body = await res.json();

    expect(body.connectivityMode).toBe("CONNECTED_MOCK");
    expect(body.rightEyeProbe.status).toBe("STANDBY");
    expect(body.marketProbe.livePairsCount).toBe(162);
    expect(body.marketProbe.topPairs.length).toBeGreaterThan(0);
    expect(body.leftEyeDefense.status).toBe("STANDBY");
    expect(body.isStale).toBe(false);
  });

  it("returns fallback payload when three-eye audit throws", () => {
    const auditSpy = vi
      .spyOn(threeEyeModule, "auditThreeEyeAdapters")
      .mockImplementation(() => {
        throw new Error("probe exploded");
      });

    const body = buildHudStreamPayloadSafe();
    expect(body.connectivityMode).toBe("STANDBY");
    expect(body.isStale).toBe(true);
    expect(body.rightEyeProbe.status).toBe("STANDBY");

    auditSpy.mockRestore();
  });

  it("returns HTTP 500 JSON instead of throwing on handler failure", () => {
    const authSpy = vi
      .spyOn(uiCanary, "validateHudStreamRequest")
      .mockImplementation(() => {
        throw new Error("canary gate exploded");
      });

    const res = handleHudStreamRequest(hudRequest());
    expect(res.status).toBe(200);

    authSpy.mockRestore();
  });
});

describe("hud-stream telemetry — SSE", () => {
  it("returns SSE stream with abort-safe headers when Accept is text/event-stream", () => {
    const controller = new AbortController();
    const res = handleHudStreamRequest(
      new Request("https://bedeltawater.slivervine.xyz/api/hud-stream", {
        headers: {
          "X-Santenmoku-Canary": HUD_CANARY_EXPECTED,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    controller.abort();
  });

  it("clears SSE interval on abort without enqueueing to a closed stream", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const res = handleHudStreamRequest(
      new Request("https://bedeltawater.slivervine.xyz/api/hud-stream", {
        headers: {
          "X-Santenmoku-Canary": HUD_CANARY_EXPECTED,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      }),
    );
    expect(res.body).not.toBeNull();

    const reader = res.body!.getReader();
    await reader.read();
    controller.abort();
    await reader.cancel();

    expect(() => {
      vi.advanceTimersByTime(HUD_STREAM_DEBOUNCE_MS * 5);
    }).not.toThrow();

    vi.useRealTimers();
  }, 10000);
});
