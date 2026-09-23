import { afterEach, describe, expect, it } from "vitest";
import {
  __setSystemStateForTests,
  buildSystemState,
  readActiveSystemState,
} from "../src/core/state";
import {
  computeReconnectDelayMs,
  NETWORK_WS_HEARTBEAT_MS,
  NetworkWsClient,
} from "../src/services/network/ws-client";
import {
  createMockWsFactory,
  MockWebSocket,
} from "../src/adapters/hl/websocket";

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("NetworkWsClient stale lockout", () => {
  it("sets SystemState.isStale on disconnect with 3s heartbeat default", () => {
    __setSystemStateForTests({
      ...buildSystemState({ skipHardlockAssert: true }),
      isHedgeActive: false,
    });

    const sockets: MockWebSocket[] = [];
    const client = new NetworkWsClient({
      wsFactory: createMockWsFactory(sockets),
      autoReconnect: false,
    });

    expect(NETWORK_WS_HEARTBEAT_MS).toBe(3_000);
    client.connect();
    sockets[0]?.simulateOpen();
    expect(readActiveSystemState().isStale).toBe(false);

    sockets[0]?.simulateClose();
    expect(readActiveSystemState().isStale).toBe(true);
    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });

  it("uses exponential backoff delay curve", () => {
    expect(computeReconnectDelayMs(0)).toBe(1_000);
    expect(computeReconnectDelayMs(3)).toBe(8_000);
    expect(computeReconnectDelayMs(10)).toBe(30_000);
  });
});
