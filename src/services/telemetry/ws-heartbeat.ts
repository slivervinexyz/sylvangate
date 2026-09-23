/**
 * WS Exponential Backoff Heartbeat + REST Fail-over State Machine.
 * Backoff: 1s → 2s → 4s → 8s. After 3 consecutive reconnect failures → REST polling.
 */

export * from "./ws-heartbeat.types";
export * from "./ws-heartbeat-ping";
export * from "./ws-heartbeat-failover";
export * from "./ws-heartbeat-core";
