/**
 * WS heartbeat ping / pong evaluation helpers.
 */

import {
  WS_HEARTBEAT_PING_INTERVAL_MS,
  WS_HEARTBEAT_PONG_TIMEOUT_MS,
  type WsHeartbeatState,
} from "./ws-heartbeat.types";

export function evaluatePingPong(input: {
  lastPingAt: number | null;
  lastPongAt: number | null;
  now: number;
  pongTimeoutMs?: number;
}): { alive: boolean; stale: boolean; idleMs: number } {
  const timeout = input.pongTimeoutMs ?? WS_HEARTBEAT_PONG_TIMEOUT_MS;
  const { lastPingAt, lastPongAt, now } = input;

  if (lastPingAt === null) {
    return { alive: true, stale: false, idleMs: 0 };
  }

  const pongOk = lastPongAt !== null && lastPongAt >= lastPingAt;
  const idleMs = now - lastPingAt;

  if (!pongOk && idleMs > timeout) {
    return { alive: false, stale: true, idleMs };
  }

  return { alive: true, stale: false, idleMs };
}

export function shouldSendHeartbeatPing(
  state: WsHeartbeatState,
  now: number,
  intervalMs = WS_HEARTBEAT_PING_INTERVAL_MS,
): boolean {
  if (!state.connected || state.mode !== "websocket") return false;
  if (state.lastPingAt === null) return true;
  return now - state.lastPingAt >= intervalMs;
}

export function recordWsPing(state: WsHeartbeatState, now: number): WsHeartbeatState {
  return { ...state, lastPingAt: now };
}

export function recordWsPong(state: WsHeartbeatState, now: number): WsHeartbeatState {
  return { ...state, lastPongAt: now };
}
