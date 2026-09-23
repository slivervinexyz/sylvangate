/**
 * Hyperliquid execution adapter — thin facade over existing HL modules.
 * Zero breaking change: wraps depth-probe, liquidation-meter, ws-heartbeat, HL wire.
 */

import type { WsBookData } from "../../adapters/hl/websocket/types";
import { HyperliquidWsClient } from "../../adapters/hl/websocket";
import {
  probeWsTop3DepthBeforeExecution,
  type Top3DepthProbeResult,
} from "../hyperliquid/depth-probe";
import { measureLiquidationDistance } from "../risk/liquidation-meter";
import {
  WsHeartbeatController,
  type WsTransportMode,
} from "../telemetry/ws-heartbeat";
import type {
  AdapterFetchOptions,
  AdapterGetTop3DepthInput,
  AdapterHealthResult,
  AdapterLiquidationDistanceInput,
  AdapterPlaceOrderInput,
  AdapterPlaceOrderResult,
  AdapterStreamHealth,
  AdapterSubscribeUserStreamInput,
  AdapterUserStreamHandle,
  IExchangeAdapter,
} from "./types";

export interface HyperliquidExecutionAdapterOptions extends AdapterFetchOptions {
  wsClient?: HyperliquidWsClient;
  kv?: KVNamespace;
}

/**
 * Reference HL implementation — maps 1:1 onto existing production paths.
 * Order signing remains in session-key-executor; this adapter exposes the
 * normalized surface for future multi-DEX orchestration.
 */
export class HyperliquidExecutionAdapter implements IExchangeAdapter {
  readonly venueId = "hyperliquid" as const;
  readonly displayName = "Hyperliquid";

  private readonly ws: HyperliquidWsClient;
  private readonly heartbeat: WsHeartbeatController;
  private bookBySymbol = new Map<string, WsBookData>();

  constructor(options: HyperliquidExecutionAdapterOptions = {}) {
    this.ws =
      options.wsClient ??
      new HyperliquidWsClient({
        onMessage: (msg) => {
          if (msg.channel === "l2Book" && msg.data) {
            const coin = (msg.data as WsBookData).coin?.toUpperCase();
            if (coin) this.bookBySymbol.set(coin, msg.data as WsBookData);
          }
        },
      });
    this.heartbeat = new WsHeartbeatController({
      kv: options.kv,
      channel: "hyperliquid_user_stream",
    });
  }

  async getTop3Depth(
    input: AdapterGetTop3DepthInput,
  ): Promise<Top3DepthProbeResult> {
    const symbol = input.symbol.toUpperCase();
    return probeWsTop3DepthBeforeExecution({
      getBook: () => this.bookBySymbol.get(symbol) ?? null,
      side: input.side,
      orderUsd: input.orderUsd,
      maxSlippageBps: input.maxSlippageBps,
      leadMs: input.leadMs,
      now: () => Date.now(),
    });
  }

  async placeOrder(
    input: AdapterPlaceOrderInput,
  ): Promise<AdapterPlaceOrderResult> {
    // Signing + POST delegated to existing session-key-executor pipeline.
    // Adapter returns envelope for orchestrator — no duplicate risk gates here.
    return {
      ok: false,
      venue: this.venueId,
      route:
        input.type === "alo_post_only" ? "alo_maker_chase" : "market_taker",
      error: "HL_PLACE_ORDER_DELEGATE:wire via session-key-executor",
      reasons: ["ADAPTER_FACADE:use existing HL execution-wire + chase-engine"],
    };
  }

  async getLiquidationDistance(input: AdapterLiquidationDistanceInput) {
    return measureLiquidationDistance({
      markPx: input.markPx ?? 0,
      accountEquityUsd: input.accountEquityUsd,
      shortNotionalUsd: input.shortNotionalUsd,
    });
  }

  async subscribeUserStream(
    input: AdapterSubscribeUserStreamInput,
  ): Promise<AdapterUserStreamHandle> {
    const user = input.user.toLowerCase();
    this.ws.subscribeUserEvents(user);
    for (const sym of input.symbols ?? []) {
      this.ws.subscribeL2Book(sym.toUpperCase());
    }
    if (!this.ws.getHealth().connected) {
      this.ws.connect();
    }

    const self = this;
    return {
      venue: self.venueId,
      unsubscribe() {
        self.ws.disconnect();
      },
      getHealth(): AdapterStreamHealth {
        const snap = self.ws.getHealth();
        const hb = self.heartbeat.state;
        return {
          mode: hb.restFallbackActive ? "rest_polling" : "websocket",
          connected: snap.connected,
          heartbeat: hb,
          latencyMs: snap.latencyMs,
          stale: snap.stale,
        };
      },
    };
  }

  async checkHealth(): Promise<AdapterHealthResult> {
    const snap = this.ws.getHealth();
    const mode: WsTransportMode = snap.connected ? "websocket" : "rest_polling";
    return {
      ok: snap.connected && !snap.stale,
      venue: this.venueId,
      latencyMs: snap.latencyMs ?? 0,
      transportMode: mode,
      reasons: snap.tripReasons,
    };
  }
}

export const hyperliquidExecutionAdapter = new HyperliquidExecutionAdapter();
