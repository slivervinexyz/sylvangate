/**
 * WS reconnect backoff, REST fail-over, and KV audit helpers.
 */

import { postHlInfo } from "../exchanges/hl-l2-book";
import {
  WS_BACKOFF_SCHEDULE_MS,
  WS_DISCONNECTION_KV_KEY,
  WS_REST_FAILOVER_THRESHOLD,
  type RestPollResult,
  type WsDisconnectionEvent,
  type WsHeartbeatState,
  type WsReconnectPlan,
} from "./ws-heartbeat.types";

export function computeWsBackoffDelayMs(attemptIndex: number): number {
  const idx = Math.max(0, Math.min(attemptIndex, WS_BACKOFF_SCHEDULE_MS.length - 1));
  return WS_BACKOFF_SCHEDULE_MS[idx]!;
}

export function shouldActivateRestFallback(consecutiveFailures: number): boolean {
  return consecutiveFailures >= WS_REST_FAILOVER_THRESHOLD;
}

export function planWsReconnect(
  state: WsHeartbeatState,
  reason: string,
): { plan: WsReconnectPlan; nextState: WsHeartbeatState } {
  const attempt = state.reconnectAttempts;
  const delayMs = computeWsBackoffDelayMs(attempt);
  const consecutiveFailures = state.consecutiveFailures + 1;
  const activateRestFallback = shouldActivateRestFallback(consecutiveFailures);

  const nextState: WsHeartbeatState = {
    ...state,
    connected: false,
    reconnectAttempts: attempt + 1,
    consecutiveFailures,
    lastDisconnectReason: reason,
    restFallbackActive: activateRestFallback,
    mode: activateRestFallback ? "rest_polling" : "websocket",
  };

  return {
    plan: {
      delayMs,
      attempt: attempt + 1,
      activateRestFallback,
      reason,
    },
    nextState,
  };
}

export function onWsReconnectSuccess(state: WsHeartbeatState): WsHeartbeatState {
  return {
    ...state,
    mode: "websocket",
    connected: true,
    reconnectAttempts: 0,
    consecutiveFailures: 0,
    restFallbackActive: false,
    lastDisconnectReason: null,
    lastPingAt: null,
    lastPongAt: null,
  };
}

export function buildWsDisconnectionEvent(input: {
  reason: string;
  state: WsHeartbeatState;
  backoffDelayMs: number;
  channel?: string;
  now?: () => number;
  idFactory?: () => string;
}): WsDisconnectionEvent {
  const now = input.now ?? (() => Date.now());
  const idFactory =
    input.idFactory ?? (() => `ws-disc-${now().toString(36)}`);
  return {
    id: idFactory(),
    timestamp: new Date(now()).toISOString(),
    reason: input.reason,
    reconnectAttempts: input.state.reconnectAttempts,
    consecutiveFailures: input.state.consecutiveFailures,
    backoffDelayMs: input.backoffDelayMs,
    restFallbackActivated: input.state.restFallbackActive,
    channel: input.channel,
    transportMode: input.state.mode,
  };
}

export async function persistWsDisconnectionEvent(
  kv: KVNamespace,
  event: WsDisconnectionEvent,
): Promise<void> {
  const raw = await kv.get(WS_DISCONNECTION_KV_KEY);
  let entries: WsDisconnectionEvent[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as
        | { entries?: WsDisconnectionEvent[] }
        | WsDisconnectionEvent[];
      entries = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.entries)
          ? parsed.entries
          : [];
    } catch {
      entries = [];
    }
  }
  entries = [...entries, event].slice(-100);
  await kv.put(
    WS_DISCONNECTION_KV_KEY,
    JSON.stringify({ updatedAt: event.timestamp, entries }),
  );
}

export async function restPollL2Book(input: {
  coin: string;
  postInfo?: typeof postHlInfo;
  now?: () => number;
}): Promise<RestPollResult> {
  const now = input.now ?? (() => Date.now());
  const started = now();
  const post = input.postInfo ?? postHlInfo;
  try {
    const res = await post({ type: "l2Book", coin: input.coin });
    if (!res.ok) {
      return {
        ok: false,
        source: "rest_polling",
        coin: input.coin,
        data: null,
        latencyMs: now() - started,
        error: `HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    return {
      ok: true,
      source: "rest_polling",
      coin: input.coin,
      data,
      latencyMs: now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      source: "rest_polling",
      coin: input.coin,
      data: null,
      latencyMs: now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
