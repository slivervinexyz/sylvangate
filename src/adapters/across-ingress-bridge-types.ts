/**
 * Pillar 2 — Across ingress types + route predicates (Robinhood = reference escort).
 */
import { ARBITRUM_ONE_CHAIN_ID, ROBINHOOD_MAINNET_CHAIN_ID } from "../sdk/constants";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "./robinhood/treasury-escort-stub";

export { ARBITRUM_ONE_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_MAINNET_CHAIN_ID };
export const IN_FLIGHT_BRIDGE_CAPITAL = "IN_FLIGHT_BRIDGE_CAPITAL" as const;
export const BRIDGE_TIMEOUT_FAIL_CLOSED = "BRIDGE_TIMEOUT_FAIL_CLOSED" as const;
export const BRIDGE_SETTLEMENT_TIMESTAMP_INVALID =
  "BRIDGE_SETTLEMENT_TIMESTAMP_INVALID" as const;
export const AML_INBOUND_TO_ROBINHOOD_BLOCKED = "AML_INBOUND_TO_ROBINHOOD_BLOCKED" as const;
export const DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS = 3_600_000;

export type BridgeCapitalLabel =
  | "AVAILABLE"
  | typeof IN_FLIGHT_BRIDGE_CAPITAL
  | "SETTLED"
  | typeof BRIDGE_TIMEOUT_FAIL_CLOSED
  | typeof BRIDGE_SETTLEMENT_TIMESTAMP_INVALID
  | typeof AML_INBOUND_TO_ROBINHOOD_BLOCKED;

export interface AcrossBridgeDirectionInput {
  sourceChainId: number;
  destChainId: number;
}

export interface AcrossBridgeOutboundInput {
  amountUsd: number;
  wallet: string;
  initiatedAtMs: number;
  sourceChainId?: number;
  destChainId?: number;
}

export interface AcrossBridgeEvaluation {
  ok: boolean;
  routeAllowed: boolean;
  deployable: boolean;
  direction: "outbound-only" | "blocked";
  capitalLabel: BridgeCapitalLabel;
  inFlightUsd: number;
  settledUsd: number;
  lostUsd: number;
  inboundToRobinhoodPermitted: false;
  reasons: string[];
}

const rh = (id: number): boolean =>
  id === ROBINHOOD_TESTNET_CHAIN_ID || id === ROBINHOOD_MAINNET_CHAIN_ID;

export function isRobinhoodToArbitrumRoute(sourceChainId: number, destChainId: number): boolean {
  return rh(sourceChainId) && destChainId === ARBITRUM_ONE_CHAIN_ID;
}

export function isInboundToRobinhoodRoute(sourceChainId: number, destChainId: number): boolean {
  return !rh(sourceChainId) && rh(destChainId);
}
