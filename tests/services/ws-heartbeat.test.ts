import { describe, expect, it, vi } from "vitest";
import {
  WS_BACKOFF_SCHEDULE_MS,
  WS_DISCONNECTION_KV_KEY,
  WS_REST_FAILOVER_THRESHOLD,
  WsHeartbeatController,
  buildWsDisconnectionEvent,
  computeWsBackoffDelayMs,
  createWsHeartbeatState,
  evaluatePingPong,
  persistWsDisconnectionEvent,
  planWsReconnect,
  restPollL2Book,
  shouldActivateRestFallback,
} from "../../src/services/telemetry/ws-heartbeat";

describe("ws-heartbeat backoff", () => {
  it("computes exponential backoff 1s → 2s → 4s → 8s", () => {
    expect(computeWsBackoffDelayMs(0)).toBe(1_000);
    expect(computeWsBackoffDelayMs(1)).toBe(2_000);
    expect(computeWsBackoffDelayMs(2)).toBe(4_000);
    expect(computeWsBackoffDelayMs(3)).toBe(8_000);
    expect(computeWsBackoffDelayMs(99)).toBe(8_000);
    expect(WS_BACKOFF_SCHEDULE_MS).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it("activates REST fallback after 3 consecutive failures", () => {
    expect(shouldActivateRestFallback(2)).toBe(false);
    expect(shouldActivateRestFallback(WS_REST_FAILOVER_THRESHOLD)).toBe(true);
  });
});

describe("ws-heartbeat ping/pong", () => {
  it("detects stale when pong missing after ping timeout", () => {
    const result = evaluatePingPong({
      lastPingAt: 1_000,
      lastPongAt: null,
      now: 7_000,
      pongTimeoutMs: 5_000,
    });
    expect(result.alive).toBe(false);
    expect(result.stale).toBe(true);
  });

  it("remains alive when pong received after ping", () => {
    const result = evaluatePingPong({
      lastPingAt: 1_000,
      lastPongAt: 1_500,
      now: 2_000,
    });
    expect(result.alive).toBe(true);
    expect(result.stale).toBe(false);
  });
});

describe("ws-heartbeat reconnect state machine", () => {
  it("increments failures and schedules backoff on disconnect", () => {
    let state = createWsHeartbeatState();
    const first = planWsReconnect(state, "WS_CLOSE");
    expect(first.plan.delayMs).toBe(1_000);
    expect(first.nextState.consecutiveFailures).toBe(1);
    expect(first.plan.activateRestFallback).toBe(false);

    const second = planWsReconnect(first.nextState, "WS_CLOSE");
    expect(second.plan.delayMs).toBe(2_000);
    expect(second.nextState.consecutiveFailures).toBe(2);

    const third = planWsReconnect(second.nextState, "WS_CLOSE");
    expect(third.plan.delayMs).toBe(4_000);
    expect(third.nextState.consecutiveFailures).toBe(3);
    expect(third.plan.activateRestFallback).toBe(true);
    expect(third.nextState.mode).toBe("rest_polling");
    expect(third.nextState.restFallbackActive).toBe(true);
  });
});

describe("ws-heartbeat KV audit", () => {
  it("persists wsDisconnectionEvent to EXECUTION_LOGS_KV", async () => {
    const store: Record<string, string> = {};
    const kv = {
      get: vi.fn(async (key: string) => store[key] ?? null),
      put: vi.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
    } as unknown as KVNamespace;

    const event = buildWsDisconnectionEvent({
      reason: "WS_STALE",
      state: {
        ...createWsHeartbeatState(),
        reconnectAttempts: 2,
        consecutiveFailures: 2,
        restFallbackActive: false,
      },
      backoffDelayMs: 2_000,
      channel: "l2Book",
      now: () => 1_700_000_000_000,
      idFactory: () => "evt-1",
    });

    await persistWsDisconnectionEvent(kv, event);

    expect(kv.put).toHaveBeenCalled();
    const raw = store[WS_DISCONNECTION_KV_KEY];
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { entries: Array<{ id: string; reason: string }> };
    expect(parsed.entries.at(-1)?.id).toBe("evt-1");
    expect(parsed.entries.at(-1)?.reason).toBe("WS_STALE");
  });
});

describe("WsHeartbeatController", () => {
  it("triggers REST fallback callback on 3rd disconnect", async () => {
    const onRestFallback = vi.fn();
    const persistEvent = vi.fn(async () => {});
    const kv = {} as KVNamespace;

    const ctrl = new WsHeartbeatController({
      kv,
      channel: "l2Book",
      onRestFallback,
      persistEvent,
    });

    ctrl.markDisconnected("attempt-1");
    ctrl.markDisconnected("attempt-2");
    const plan = ctrl.markDisconnected("attempt-3");

    expect(plan.activateRestFallback).toBe(true);
    expect(ctrl.state.mode).toBe("rest_polling");
    expect(onRestFallback).toHaveBeenCalledTimes(1);
    expect(persistEvent).toHaveBeenCalledTimes(3);
  });

  it("resets state on successful reconnect", () => {
    const ctrl = new WsHeartbeatController();
    ctrl.markDisconnected("fail");
    ctrl.markConnected();
    expect(ctrl.state.consecutiveFailures).toBe(0);
    expect(ctrl.state.mode).toBe("websocket");
    expect(ctrl.state.connected).toBe(true);
  });

  it("issues ping ticks while connected", () => {
    const ctrl = new WsHeartbeatController({ now: () => 10_000 });
    ctrl.markConnected();
    expect(ctrl.tickPing()).toBe(true);
    expect(ctrl.state.lastPingAt).toBe(10_000);
    expect(ctrl.tickPing()).toBe(false);
  });
});

describe("REST fail-over polling", () => {
  it("restPollL2Book uses injected postInfo", async () => {
    const postInfo = vi.fn(async () => ({
      ok: true,
      json: async () => ({ coin: "ETH", levels: [[], []] }),
    })) as unknown as typeof import("../../src/services/exchanges/hl-l2-book").postHlInfo;

    const result = await restPollL2Book({
      coin: "ETH",
      postInfo,
      now: () => 0,
    });

    expect(postInfo).toHaveBeenCalledWith({ type: "l2Book", coin: "ETH" });
    expect(result.ok).toBe(true);
    expect(result.source).toBe("rest_polling");
  });

  it("controller runRestFallbackPoll delegates to REST poller", async () => {
    const postInfo = vi.fn(async () => ({
      ok: true,
      json: async () => ({ coin: "SOL", levels: [[], []] }),
    })) as unknown as typeof import("../../src/services/exchanges/hl-l2-book").postHlInfo;

    const ctrl = new WsHeartbeatController({ coin: "SOL", postInfo });
    ctrl.state.restFallbackActive = true;
    ctrl.state.mode = "rest_polling";

    const result = await ctrl.runRestFallbackPoll();
    expect(postInfo).toHaveBeenCalledWith({ type: "l2Book", coin: "SOL" });
    expect(result.ok).toBe(true);
    expect(result.source).toBe("rest_polling");
  });
});
