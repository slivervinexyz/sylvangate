/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 *
 * @slivervine/exomesh-agentic-wallet-guard — assertUnidirectionalBridge
 *
 * Route equations:
 * - robinhood(c) ⇔ c ∈ {46630, 4663}
 * - outboundOk   ⇔ robinhood(src) ∧ dest = 42161
 * - inboundBlock ⇔ ¬robinhood(src) ∧ robinhood(dest)  → AML_INBOUND_TO_ROBINHOOD_BLOCKED
 * - lostUsd ≡ 0 (in-flight never booked as loss)
 */
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS,
  evaluateAcrossBridgeTransfer,
  type BridgeCapitalLabel,
} from "../adapters/across-ingress-bridge";
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "./constants";

export interface UnidirectionalBridgeInput {
  sourceChainId: number;
  destChainId: number;
  amountUsd: number;
  wallet: string;
  initiatedAtMs: number;
  settledAtMs?: number | null;
  nowMs?: number;
  timeoutMs?: number;
}

export interface BridgeEscortVerdict {
  ok: boolean;
  routeAllowed: boolean;
  deployable: boolean;
  direction: "outbound-only" | "blocked";
  capitalLabel: BridgeCapitalLabel;
  inFlightUsd: number;
  settledUsd: number;
  lostUsd: 0;
  inboundToRobinhoodPermitted: false;
  reasons: string[];
}

function isRobinhoodSource(chainId: number): boolean {
  return chainId === ROBINHOOD_TESTNET_CHAIN_ID || chainId === ROBINHOOD_MAINNET_CHAIN_ID;
}

function blocked(
  capitalLabel: BridgeCapitalLabel,
  reasons: string[],
): BridgeEscortVerdict {
  return {
    ok: false,
    routeAllowed: false,
    deployable: false,
    direction: "blocked",
    capitalLabel,
    inFlightUsd: 0,
    settledUsd: 0,
    lostUsd: 0,
    inboundToRobinhoodPermitted: false,
    reasons,
  };
}

export function assertUnidirectionalBridge(
  input: UnidirectionalBridgeInput,
): BridgeEscortVerdict {
  const { sourceChainId, destChainId } = input;

  if (!isRobinhoodSource(sourceChainId) && isRobinhoodSource(destChainId)) {
    return blocked(AML_INBOUND_TO_ROBINHOOD_BLOCKED, [AML_INBOUND_TO_ROBINHOOD_BLOCKED]);
  }

  if (!(isRobinhoodSource(sourceChainId) && destChainId === ARBITRUM_ONE_CHAIN_ID)) {
    return blocked("AVAILABLE", ["BRIDGE_ROUTE_UNSUPPORTED"]);
  }

  const sourceForEval =
    sourceChainId === ROBINHOOD_MAINNET_CHAIN_ID
      ? ROBINHOOD_TESTNET_CHAIN_ID
      : sourceChainId;

  const evaluated = evaluateAcrossBridgeTransfer(
    {
      amountUsd: input.amountUsd,
      wallet: input.wallet,
      initiatedAtMs: input.initiatedAtMs,
      sourceChainId: sourceForEval,
      destChainId,
    },
    {
      nowMs: input.nowMs,
      settledAtMs: input.settledAtMs,
      timeoutMs: input.timeoutMs ?? DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS,
    },
  );

  return {
    ok: evaluated.ok,
    routeAllowed: evaluated.routeAllowed,
    deployable: evaluated.deployable,
    direction: evaluated.direction,
    capitalLabel: evaluated.capitalLabel,
    inFlightUsd: evaluated.inFlightUsd,
    settledUsd: evaluated.settledUsd,
    lostUsd: 0,
    inboundToRobinhoodPermitted: false,
    reasons: evaluated.reasons,
  };
}
