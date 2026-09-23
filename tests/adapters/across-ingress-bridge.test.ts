import { describe, expect, it } from "vitest";
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  BRIDGE_SETTLEMENT_TIMESTAMP_INVALID,
  BRIDGE_TIMEOUT_FAIL_CLOSED,
  DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS,
  IN_FLIGHT_BRIDGE_CAPITAL,
  ROBINHOOD_TESTNET_CHAIN_ID,
  evaluateAcrossBridgeTransfer,
  evaluateBridgeTimeout,
  isInboundToRobinhoodRoute,
  isRobinhoodToArbitrumRoute,
  validateAcrossBridgeDirection,
} from "../../src/adapters/across-ingress-bridge";

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const T0 = 1_700_000_000_000;

describe("across-ingress-bridge", () => {
  it("allows unidirectional outbound Robinhood (46630) → Arbitrum One (42161)", () => {
    expect(
      isRobinhoodToArbitrumRoute(ROBINHOOD_TESTNET_CHAIN_ID, ARBITRUM_ONE_CHAIN_ID),
    ).toBe(true);
    const dir = validateAcrossBridgeDirection({
      sourceChainId: ROBINHOOD_TESTNET_CHAIN_ID,
      destChainId: ARBITRUM_ONE_CHAIN_ID,
    });
    expect(dir.ok).toBe(true);
    expect(dir.inboundBlocked).toBe(false);
  });

  it("marks in-flight bridge capital without booking loss", () => {
    const state = evaluateAcrossBridgeTransfer(
      {
        amountUsd: 2_500,
        wallet: WALLET,
        initiatedAtMs: T0,
      },
      { nowMs: T0 + 60_000 },
    );
    expect(state.ok).toBe(true);
    expect(state.routeAllowed).toBe(true);
    expect(state.deployable).toBe(false);
    expect(state.capitalLabel).toBe(IN_FLIGHT_BRIDGE_CAPITAL);
    expect(state.inFlightUsd).toBe(2_500);
    expect(state.settledUsd).toBe(0);
    expect(state.lostUsd).toBe(0);
    expect(state.inboundToRobinhoodPermitted).toBe(false);
  });

  it("settles outbound bridge and clears in-flight label", () => {
    const state = evaluateAcrossBridgeTransfer(
      {
        amountUsd: 1_000,
        wallet: WALLET,
        initiatedAtMs: T0,
      },
      { nowMs: T0 + 120_000, settledAtMs: T0 + 90_000 },
    );
    expect(state.capitalLabel).toBe("SETTLED");
    expect(state.routeAllowed).toBe(true);
    expect(state.deployable).toBe(true);
    expect(state.settledUsd).toBe(1_000);
    expect(state.inFlightUsd).toBe(0);
    expect(state.lostUsd).toBe(0);
  });

  it("AML isolation blocks inbound flow to Robinhood Chain", () => {
    expect(
      isInboundToRobinhoodRoute(ARBITRUM_ONE_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID),
    ).toBe(true);
    expect(
      isInboundToRobinhoodRoute(ARBITRUM_ONE_CHAIN_ID, 4663),
    ).toBe(true);
    const dir = validateAcrossBridgeDirection({
      sourceChainId: ARBITRUM_ONE_CHAIN_ID,
      destChainId: ROBINHOOD_TESTNET_CHAIN_ID,
    });
    expect(dir.ok).toBe(false);
    expect(dir.inboundBlocked).toBe(true);
    expect(dir.reasons).toContain(AML_INBOUND_TO_ROBINHOOD_BLOCKED);

    const inboundMainnet = evaluateAcrossBridgeTransfer({
      amountUsd: 500,
      wallet: WALLET,
      initiatedAtMs: T0,
      sourceChainId: ARBITRUM_ONE_CHAIN_ID,
      destChainId: 4663,
    });
    expect(inboundMainnet.ok).toBe(false);
    expect(inboundMainnet.capitalLabel).toBe(AML_INBOUND_TO_ROBINHOOD_BLOCKED);

    const state = evaluateAcrossBridgeTransfer({
      amountUsd: 500,
      wallet: WALLET,
      initiatedAtMs: T0,
      sourceChainId: ARBITRUM_ONE_CHAIN_ID,
      destChainId: ROBINHOOD_TESTNET_CHAIN_ID,
    });
    expect(state.ok).toBe(false);
    expect(state.capitalLabel).toBe(AML_INBOUND_TO_ROBINHOOD_BLOCKED);
    expect(state.inboundToRobinhoodPermitted).toBe(false);
  });

  it("fail-closes when settledAtMs precedes initiatedAtMs (clock skew / forged)", () => {
    const state = evaluateAcrossBridgeTransfer(
      {
        amountUsd: 1_000,
        wallet: WALLET,
        initiatedAtMs: T0,
      },
      { nowMs: T0 + 60_000, settledAtMs: T0 - 1 },
    );
    expect(state.ok).toBe(false);
    expect(state.routeAllowed).toBe(false);
    expect(state.deployable).toBe(false);
    expect(state.capitalLabel).toBe(BRIDGE_SETTLEMENT_TIMESTAMP_INVALID);
    expect(state.lostUsd).toBe(0);
    expect(state.reasons[0]).toContain(BRIDGE_SETTLEMENT_TIMESTAMP_INVALID);
  });

  it("fail-closes on bridge timeout without marking capital as lost", () => {
    const timeout = evaluateBridgeTimeout(
      T0,
      T0 + DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS + 1,
    );
    expect(timeout.timedOut).toBe(true);
    expect(timeout.failClosed).toBe(true);

    const state = evaluateAcrossBridgeTransfer(
      {
        amountUsd: 750,
        wallet: WALLET,
        initiatedAtMs: T0,
      },
      { nowMs: T0 + DEFAULT_ACROSS_BRIDGE_TIMEOUT_MS + 5_000 },
    );
    expect(state.ok).toBe(false);
    expect(state.capitalLabel).toBe(BRIDGE_TIMEOUT_FAIL_CLOSED);
    expect(state.inFlightUsd).toBe(0);
    expect(state.lostUsd).toBe(0);
    expect(state.reasons[0]).toContain(BRIDGE_TIMEOUT_FAIL_CLOSED);
  });
});
