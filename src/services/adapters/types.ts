/**
 * Zero-Pain Multi-DEX Execution Adapter — venue-agnostic contract.
 * Risk core (escalation-ladder, liquidation-meter, soil-protection) consumes
 * normalized outputs only; venue wiring lives behind IExchangeAdapter.
 *
 * NOTE: Distinct from yield-triangle `IExchangeAdapter` in `src/adapters/types.ts`.
 */

import type { Top3DepthProbeResult } from "../hyperliquid/depth-probe";
import type { LiquidationMeterResult } from "../risk/liquidation-meter";
import type {
  WsHeartbeatState,
  WsTransportMode,
} from "../telemetry/ws-heartbeat";

/** Execution-layer venue ids — HL primary · GMX v2. */
export type ExecutionVenueId = "hyperliquid" | "gmx";

export type AdapterOrderSide = "buy" | "sell";

/** Market IOC/FOK taker vs Post-Only ALO maker (chase-compatible). */
export type AdapterOrderType = "market" | "alo_post_only";

export type AdapterMarketKind = "spot" | "perp";

/** Shared 50ms Top-3 depth probe input — maps to depth-probe.ts pure math. */
export interface AdapterGetTop3DepthInput {
  symbol: string;
  side: AdapterOrderSide;
  market?: AdapterMarketKind;
  /** Probe notional — defaults to MICRO_CAPITAL_USD ($300). */
  orderUsd?: number;
  /** Pre-execution WS lead — defaults to DEPTH_PROBE_LEAD_MS (50ms). */
  leadMs?: number;
  maxSlippageBps?: number;
}

export interface AdapterPlaceOrderInput {
  symbol: string;
  side: AdapterOrderSide;
  type: AdapterOrderType;
  market?: AdapterMarketKind;
  /** Target notional in USD (adapter resolves size decimals). */
  sizeUsd: number;
  limitPrice?: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface AdapterPlaceOrderResult {
  ok: boolean;
  venue: ExecutionVenueId;
  route: "market_taker" | "alo_maker_chase";
  orderId?: string | number;
  txHash?: string;
  filledNotionalUsd?: number;
  error?: string;
  reasons: string[];
}

export interface AdapterLiquidationDistanceInput {
  symbol: string;
  user: string;
  markPx?: number;
  /** Override for vault-style integrations. */
  accountEquityUsd?: number;
  shortNotionalUsd?: number;
}

export interface AdapterStreamHealth {
  mode: WsTransportMode;
  connected: boolean;
  heartbeat: WsHeartbeatState;
  latencyMs: number | null;
  stale: boolean;
}

export type AdapterUserStreamEvent =
  | { kind: "fill"; payload: unknown }
  | { kind: "order_update"; payload: unknown }
  | { kind: "position"; payload: unknown }
  | { kind: "heartbeat"; payload: { at: number } }
  | { kind: "transport_switch"; payload: { mode: WsTransportMode; reason: string } };

export interface AdapterUserStreamHandle {
  venue: ExecutionVenueId;
  unsubscribe(): void;
  getHealth(): AdapterStreamHealth;
}

export interface AdapterSubscribeUserStreamInput {
  user: string;
  symbols?: string[];
  onEvent: (event: AdapterUserStreamEvent) => void;
  onHealthChange?: (health: AdapterStreamHealth) => void;
}

export interface AdapterHealthResult {
  ok: boolean;
  venue: ExecutionVenueId;
  latencyMs: number;
  transportMode: WsTransportMode;
  reasons: string[];
}

export interface AdapterFetchOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
}

/**
 * Zero-Pain execution adapter — four canonical surfaces shared by HL / Vertex / GMX.
 *
 * Implementations MUST:
 * - Stay Workers-safe (pure fetch / WS, no Node-only SDKs)
 * - Pass rpc-whitelist + checkSoilResistance() on outbound calls
 * - Delegate Top-3 math to depth-probe.ts (no duplicate slippage logic)
 * - Delegate liq distance to liquidation-meter.ts (no duplicate MMR math)
 * - Wire WS heartbeat via ws-heartbeat.ts state machine (REST fail-over @ 3 failures)
 */
export interface IExchangeAdapter {
  readonly venueId: ExecutionVenueId;
  readonly displayName: string;

  /** 50ms WS Top-3 depth probe — pre-execution soil gate input. */
  getTop3Depth(input: AdapterGetTop3DepthInput): Promise<Top3DepthProbeResult>;

  /** Place market or ALO Post-Only order — chase-engine compatible. */
  placeOrder(input: AdapterPlaceOrderInput): Promise<AdapterPlaceOrderResult>;

  /** Normalized liquidation distance % — feeds escalation-ladder unchanged. */
  getLiquidationDistance(
    input: AdapterLiquidationDistanceInput,
  ): Promise<LiquidationMeterResult>;

  /** User fills/positions stream — exponential backoff + REST polling fallback. */
  subscribeUserStream(
    input: AdapterSubscribeUserStreamInput,
  ): Promise<AdapterUserStreamHandle>;

  /** Optional venue liveness probe for HUD / grant audit. */
  checkHealth?(): Promise<AdapterHealthResult>;
}

/** Registry type for dependency injection without touching risk-control.ts. */
export type ExecutionAdapterRegistry = Readonly<
  Record<ExecutionVenueId, IExchangeAdapter | undefined>
>;

export function resolveExecutionAdapter(
  registry: ExecutionAdapterRegistry,
  venue: ExecutionVenueId,
): IExchangeAdapter {
  const adapter = registry[venue];
  if (!adapter) {
    throw new Error(`EXECUTION_ADAPTER_MISSING:venue=${venue}`);
  }
  return adapter;
}
