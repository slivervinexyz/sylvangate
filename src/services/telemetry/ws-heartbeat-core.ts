/**
 * WS Exponential Backoff Heartbeat + REST Fail-over State Machine core.
 */

import { HL_INFO_URL } from "../../config/constants";
import { postHlInfo } from "../exchanges/hl-l2-book";
import {
  buildWsDisconnectionEvent,
  onWsReconnectSuccess,
  persistWsDisconnectionEvent,
  planWsReconnect,
  restPollL2Book,
} from "./ws-heartbeat-failover";
import {
  evaluatePingPong,
  recordWsPing,
  recordWsPong,
  shouldSendHeartbeatPing,
} from "./ws-heartbeat-ping";
import type {
  RestPollResult,
  WsDisconnectionEvent,
  WsHeartbeatControllerOptions,
  WsHeartbeatState,
  WsReconnectPlan,
} from "./ws-heartbeat.types";

export function createWsHeartbeatState(): WsHeartbeatState {
  return {
    mode: "websocket",
    reconnectAttempts: 0,
    consecutiveFailures: 0,
    lastPingAt: null,
    lastPongAt: null,
    lastDisconnectReason: null,
    restFallbackActive: false,
    connected: false,
  };
}

export class WsHeartbeatController {
  state: WsHeartbeatState;
  private readonly kv?: KVNamespace;
  private readonly channel?: string;
  private readonly coin: string;
  private readonly now: () => number;
  private readonly postInfo: typeof postHlInfo;
  private readonly onRestFallback?: (event: WsDisconnectionEvent) => void;
  private readonly persistEvent: typeof persistWsDisconnectionEvent;

  constructor(options: WsHeartbeatControllerOptions = {}) {
    this.state = createWsHeartbeatState();
    this.kv = options.kv;
    this.channel = options.channel;
    this.coin = options.coin ?? "ETH";
    this.now = options.now ?? (() => Date.now());
    this.postInfo = options.postInfo ?? postHlInfo;
    this.onRestFallback = options.onRestFallback;
    this.persistEvent = options.persistEvent ?? persistWsDisconnectionEvent;
  }

  markConnected(): void {
    this.state = onWsReconnectSuccess(this.state);
  }

  markDisconnected(reason: string): WsReconnectPlan {
    const { plan, nextState } = planWsReconnect(this.state, reason);
    this.state = nextState;
    void this.auditDisconnect(plan);
    if (plan.activateRestFallback) {
      const event = buildWsDisconnectionEvent({
        reason: `REST_FAILOVER:${reason}`,
        state: this.state,
        backoffDelayMs: plan.delayMs,
        channel: this.channel,
        now: this.now,
      });
      this.onRestFallback?.(event);
    }
    return plan;
  }

  tickPing(): boolean {
    if (!shouldSendHeartbeatPing(this.state, this.now())) return false;
    this.state = recordWsPing(this.state, this.now());
    return true;
  }

  onPongReceived(): void {
    this.state = recordWsPong(this.state, this.now());
  }

  checkHeartbeatStale(): boolean {
    const { stale } = evaluatePingPong({
      lastPingAt: this.state.lastPingAt,
      lastPongAt: this.state.lastPongAt,
      now: this.now(),
    });
    return stale;
  }

  async runRestFallbackPoll(): Promise<RestPollResult> {
    return restPollL2Book({
      coin: this.coin,
      postInfo: this.postInfo,
      now: this.now,
    });
  }

  private async auditDisconnect(plan: WsReconnectPlan): Promise<void> {
    if (!this.kv) return;
    const event = buildWsDisconnectionEvent({
      reason: plan.reason,
      state: this.state,
      backoffDelayMs: plan.delayMs,
      channel: this.channel,
      now: this.now,
    });
    await this.persistEvent(this.kv, event);
  }
}

export { HL_INFO_URL };
