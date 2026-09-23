/** Unidirectional Across state machine — lostUsd ≡ 0; deployable ⇔ SETTLED ∧ routeAllowed. */
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  BRIDGE_SETTLEMENT_TIMESTAMP_INVALID,
  BRIDGE_TIMEOUT_FAIL_CLOSED,
  DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS,
  IN_FLIGHT_BRIDGE_CAPITAL,
  isInboundToRobinhoodRoute,
  isRobinhoodToArbitrumRoute,
  ROBINHOOD_TESTNET_CHAIN_ID,
  type AcrossBridgeDirectionInput,
  type AcrossBridgeEvaluation,
  type AcrossBridgeOutboundInput,
  type BridgeCapitalLabel,
} from "./across-ingress-bridge-types";

export {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  BRIDGE_SETTLEMENT_TIMESTAMP_INVALID,
  BRIDGE_TIMEOUT_FAIL_CLOSED,
  DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS,
  IN_FLIGHT_BRIDGE_CAPITAL,
  isInboundToRobinhoodRoute,
  isRobinhoodToArbitrumRoute,
  ROBINHOOD_TESTNET_CHAIN_ID,
};
export type { AcrossBridgeDirectionInput, AcrossBridgeEvaluation, AcrossBridgeOutboundInput, BridgeCapitalLabel };
export { ROBINHOOD_MAINNET_CHAIN_ID } from "./across-ingress-bridge-types";

const BASE = {
  lostUsd: 0 as const,
  inboundToRobinhoodPermitted: false as const,
};

function pack(
  ok: boolean,
  routeAllowed: boolean,
  direction: AcrossBridgeEvaluation["direction"],
  capitalLabel: BridgeCapitalLabel,
  inFlightUsd: number,
  settledUsd: number,
  reasons: string[],
): AcrossBridgeEvaluation {
  return {
    ...BASE,
    ok,
    routeAllowed,
    deployable: routeAllowed && capitalLabel === "SETTLED",
    direction,
    capitalLabel,
    inFlightUsd,
    settledUsd,
    reasons,
  };
}

export function validateAcrossBridgeDirection(
  input: AcrossBridgeDirectionInput,
): { ok: boolean; inboundBlocked: boolean; reasons: string[] } {
  if (isInboundToRobinhoodRoute(input.sourceChainId, input.destChainId)) {
    return { ok: false, inboundBlocked: true, reasons: [AML_INBOUND_TO_ROBINHOOD_BLOCKED] };
  }
  if (!isRobinhoodToArbitrumRoute(input.sourceChainId, input.destChainId)) {
    return { ok: false, inboundBlocked: false, reasons: ["BRIDGE_ROUTE_UNSUPPORTED"] };
  }
  return { ok: true, inboundBlocked: false, reasons: [] };
}

export function evaluateBridgeTimeout(
  initiatedAtMs: number,
  nowMs: number,
  timeoutMs = DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS,
): { timedOut: boolean; failClosed: boolean; elapsedMs: number } {
  const elapsedMs = Math.max(0, nowMs - initiatedAtMs);
  return { timedOut: elapsedMs > timeoutMs, failClosed: elapsedMs > timeoutMs, elapsedMs };
}

export function evaluateAcrossBridgeTransfer(
  input: AcrossBridgeOutboundInput,
  options: { nowMs?: number; settledAtMs?: number | null; timeoutMs?: number } = {},
): AcrossBridgeEvaluation {
  const nowMs = options.nowMs ?? Date.now();
  const sourceChainId = input.sourceChainId ?? ROBINHOOD_TESTNET_CHAIN_ID;
  const destChainId = input.destChainId ?? ARBITRUM_ONE_CHAIN_ID;
  const amountUsd = Math.max(0, input.amountUsd);
  const direction = validateAcrossBridgeDirection({ sourceChainId, destChainId });
  if (!direction.ok) {
    return pack(false, false, "blocked", direction.inboundBlocked ? AML_INBOUND_TO_ROBINHOOD_BLOCKED : BRIDGE_TIMEOUT_FAIL_CLOSED, 0, 0, direction.reasons);
  }
  if (!(amountUsd > 0)) {
    return pack(false, false, "outbound-only", "AVAILABLE", 0, 0, ["BRIDGE_AMOUNT_ZERO"]);
  }
  const timeout = evaluateBridgeTimeout(input.initiatedAtMs, nowMs, options.timeoutMs);
  const cap = options.timeoutMs ?? DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS;
  if (
    options.settledAtMs != null &&
    options.settledAtMs < input.initiatedAtMs
  ) {
    return pack(
      false,
      false,
      "outbound-only",
      BRIDGE_SETTLEMENT_TIMESTAMP_INVALID,
      0,
      0,
      [
        `${BRIDGE_SETTLEMENT_TIMESTAMP_INVALID}:settledAtMs=${options.settledAtMs}<initiatedAtMs=${input.initiatedAtMs}`,
      ],
    );
  }
  if (timeout.failClosed && options.settledAtMs == null) {
    return pack(false, false, "outbound-only", BRIDGE_TIMEOUT_FAIL_CLOSED, 0, 0, [`${BRIDGE_TIMEOUT_FAIL_CLOSED}:${timeout.elapsedMs}ms>${cap}ms`]);
  }
  if (options.settledAtMs != null) {
    return pack(true, true, "outbound-only", "SETTLED", 0, amountUsd, ["BRIDGE_SETTLED"]);
  }
  return pack(true, true, "outbound-only", IN_FLIGHT_BRIDGE_CAPITAL, amountUsd, 0, ["BRIDGE_IN_FLIGHT"]);
}
