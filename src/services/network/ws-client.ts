/**
 * Network WS client — 3s ping/pong heartbeat, backoff reconnect, stale lockout.
 */

import {
  HyperliquidWsClient,
  type HyperliquidWsClientOptions,
  type WsHealthSnapshot,
} from "../../adapters/hl/websocket";
import {
  clearSystemStateStale,
  markSystemStateStale,
} from "../state/system-state";

export const NETWORK_WS_HEARTBEAT_MS = 3_000;
export const NETWORK_WS_RECONNECT_BASE_MS = 1_000;
export const NETWORK_WS_RECONNECT_MAX_MS = 30_000;

export interface NetworkWsClientOptions extends HyperliquidWsClientOptions {
  onStaleLock?: (health: WsHealthSnapshot) => void;
}

export class NetworkWsClient extends HyperliquidWsClient {
  private readonly onStaleLock?: (health: WsHealthSnapshot) => void;

  constructor(options: NetworkWsClientOptions = {}) {
    super({
      ...options,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? NETWORK_WS_HEARTBEAT_MS,
      onHealthChange: (health) => {
        if (!health.connected || health.stale) {
          markSystemStateStale(
            health.connected ? "WS_STALE" : "WS_DISCONNECTED",
          );
          this.onStaleLock?.(health);
        } else {
          clearSystemStateStale();
        }
        options.onHealthChange?.(health);
      },
    });
    this.onStaleLock = options.onStaleLock;
  }
}

export function computeReconnectDelayMs(attempt: number): number {
  return Math.min(
    NETWORK_WS_RECONNECT_BASE_MS * 2 ** Math.max(0, attempt),
    NETWORK_WS_RECONNECT_MAX_MS,
  );
}
