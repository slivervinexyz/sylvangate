import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGATE_MAX_LATENCY_MS } from "../../../src/adapters/hl/execution";
import {
  HL_WS_URL,
  HyperliquidWsClient,
  MockWebSocket,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  WS_STALE_THRESHOLD_MS,
  createMockWsFactory,
  evaluateWsSoilResistance,
  type MockWebSocket as MockWs,
} from "../../../src/adapters/hl/websocket";
import { SAFE_TRADING_TIME } from "../../helpers/system-time";

describe("hl/websocket — reconnect & stale handling", () => {
  let now: number;
  let sockets: MockWs[];
  let client: HyperliquidWsClient;

  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(SAFE_TRADING_TIME);
    now = SAFE_TRADING_TIME.getTime();
    sockets = [];
    client = new HyperliquidWsClient({
      url: HL_WS_URL,
      wsFactory: createMockWsFactory(sockets),
      now: () => now,
      heartbeatIntervalMs: WS_HEARTBEAT_INTERVAL_MS,
      staleThresholdMs: WS_STALE_THRESHOLD_MS,
    });
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function activeSocket(): MockWs {
    const ws = sockets[sockets.length - 1];
    if (!ws) throw new Error("no mock socket");
    return ws;
  }

  it("flags stale and reconnects when no activity for >5s", () => {
    client.connect();
    const ws = activeSocket();
    ws.simulateOpen();
    ws.simulateMessage({ channel: "allMids", data: { mids: {} } });

    now += WS_STALE_THRESHOLD_MS + 1;
    vi.advanceTimersByTime(WS_STALE_THRESHOLD_MS + 1);

    expect(client.getHealth().stale).toBe(true);
    expect(client.getHealth().soilTripped).toBe(true);
    expect(sockets.length).toBeGreaterThan(1);
  });

  it("reconnects with exponential backoff after disconnect", () => {
    client.connect();
    const ws = activeSocket();
    ws.simulateOpen();
    ws.simulateClose(1006);

    expect(client.getHealth().connected).toBe(false);
    expect(client.getHealth().soilTripped).toBe(true);

    vi.advanceTimersByTime(WS_RECONNECT_BASE_MS);
    expect(sockets.length).toBe(2);

    const ws2 = activeSocket();
    ws2.simulateOpen();
    client.subscribeAllMids();
    ws2.simulateMessage({
      channel: "subscriptionResponse",
      data: { method: "subscribe", subscription: { type: "allMids" } },
    });

    expect(client.getHealth().connected).toBe(true);
  });

  it("trips soil when latency exceeds 200ms", () => {
    client.connect();
    const ws = activeSocket();
    ws.simulateOpen();

    vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
    now += PGATE_MAX_LATENCY_MS + 50;
    ws.simulateMessage({ channel: "pong", data: {} });

    const health = client.getHealth();
    expect(health.latencyMs).toBeGreaterThan(PGATE_MAX_LATENCY_MS);
    expect(health.soilTripped).toBe(true);

    const soil = evaluateWsSoilResistance(health);
    expect(soil.tripped).toBe(true);
    expect(soil.gate.soilResistanceTripped).toBe(true);
  });

  it("disconnect prevents auto reconnect", () => {
    client.connect();
    const ws = activeSocket();
    ws.simulateOpen();

    client.disconnect();
    ws.simulateClose(1000);

    vi.advanceTimersByTime(WS_RECONNECT_MAX_MS);
    expect(sockets.length).toBe(1);
  });
});

describe("hl/websocket — MockWebSocket", () => {
  it("captures sent frames and simulates events", () => {
    const ws = new MockWebSocket(HL_WS_URL);
    const opens: string[] = [];
    ws.onopen = () => opens.push("open");
    ws.simulateOpen();
    ws.send("hello");
    expect(ws.sent).toEqual(["hello"]);
    expect(opens).toEqual(["open"]);
  });
});
