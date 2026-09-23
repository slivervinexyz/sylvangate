/**
 * WS heartbeat types + schedule constants.
 */

/** Exponential backoff schedule (ms). */
export const WS_BACKOFF_SCHEDULE_MS = [1_000, 2_000, 4_000, 8_000] as const;

/** Consecutive reconnect failures before REST fail-over. */
export const WS_REST_FAILOVER_THRESHOLD = 3 as const;

/** Default ping interval while WS connected. */
export const WS_HEARTBEAT_PING_INTERVAL_MS = 3_000 as const;

/** Pong must arrive within this window after ping. */
export const WS_HEARTBEAT_PONG_TIMEOUT_MS = 5_000 as const;

export const WS_DISCONNECTION_KV_KEY = "ws_disconnection_events" as const;

export type WsTransportMode = "websocket" | "rest_polling";

export interface WsHeartbeatState {
  mode: WsTransportMode;
  reconnectAttempts: number;
  consecutiveFailures: number;
  lastPingAt: number | null;
  lastPongAt: number | null;
  lastDisconnectReason: string | null;
  restFallbackActive: boolean;
  connected: boolean;
}

export interface WsDisconnectionEvent {
  id: string;
  timestamp: string;
  reason: string;
  reconnectAttempts: number;
  consecutiveFailures: number;
  backoffDelayMs: number;
  restFallbackActivated: boolean;
  channel?: string;
  transportMode: WsTransportMode;
}

export interface WsReconnectPlan {
  delayMs: number;
  attempt: number;
  activateRestFallback: boolean;
  reason: string;
}

export interface RestPollResult {
  ok: boolean;
  source: "rest_polling";
  coin: string;
  data: unknown;
  latencyMs: number;
  error?: string;
}

export interface WsHeartbeatControllerOptions {
  kv?: KVNamespace;
  channel?: string;
  coin?: string;
  now?: () => number;
  postInfo?: typeof import("../exchanges/hl-l2-book").postHlInfo;
  onRestFallback?: (event: WsDisconnectionEvent) => void;
  persistEvent?: (kv: KVNamespace, event: WsDisconnectionEvent) => Promise<void>;
}
