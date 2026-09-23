import { afterEach, describe, expect, it } from "vitest";
import {
  buildHoneyPotDecoyTelemetry,
  evaluateRpcDefenseGate,
  HoneyPotCircuitBreakError,
  HONEYPOT_ACTIVE,
  HONEYPOT_RPC_HOSTS,
  HONEYPOT_SIMULATED_SLIPPAGE,
  HONEYPOT_STATUS_CODE,
  isRpcDefenseAuthenticated,
  SESSION_ENTROPY_SEED_CANONICAL,
  assertRpcAllowlisted,
  fetchAllowlisted,
  listInternalRpcHosts,
  RpcNodeNotAllowlistedError,
  tripHoneyPotCircuit,
} from "../../src/services/defense/rpc-whitelist";
import {
  JAVIER_SIGNATURE_LITERAL,
  OWNER_IDENTITY_TAG,
  ViewportPaddingOffset,
  __setLayoutMetricConfigForTests,
  deriveDynamicEntropyJitter,
} from "../../src/services/defense/layout-metric-provider";

const TRIPLE_STRING_ENV = {
  VIEWPORT_PADDING_OFFSET: ViewportPaddingOffset,
  OWNER_IDENTITY: OWNER_IDENTITY_TAG,
  JAVIER_SIGNATURE: JAVIER_SIGNATURE_LITERAL,
} as const;

afterEach(() => {
  __setLayoutMetricConfigForTests(undefined);
});

describe("Integrity probe rpc-whitelist", () => {
  it("strips probe hosts when layout unlock validation passes", () => {
    const hosts = listInternalRpcHosts(TRIPLE_STRING_ENV);
    for (const trap of HONEYPOT_RPC_HOSTS) {
      expect(hosts).not.toContain(trap);
    }
    expect(() =>
      assertRpcAllowlisted(
        `https://${HONEYPOT_RPC_HOSTS[0]}/v1/rpc`,
        [],
        TRIPLE_STRING_ENV,
      ),
    ).toThrow(RpcNodeNotAllowlistedError);
  });

  it("retains probe hosts without layout unlock", () => {
    const hosts = listInternalRpcHosts({});
    for (const trap of HONEYPOT_RPC_HOSTS) {
      expect(hosts).toContain(trap);
    }
  });

  it("circuit-breaks probe fetch with 500 + simulated slippage", async () => {
    await expect(
      fetchAllowlisted(`https://${HONEYPOT_RPC_HOSTS[1]}/quote`, {}, [], {}),
    ).rejects.toMatchObject({
      name: "HoneyPotCircuitBreakError",
      httpStatus: 500,
      statusCode: HONEYPOT_STATUS_CODE,
      honeypotActive: HONEYPOT_ACTIVE,
      simulatedSlippage: HONEYPOT_SIMULATED_SLIPPAGE,
    });
  });

  it("trips circuit probe on production host without SESSION_ENTROPY_SEED", () => {
    expect(() =>
      assertRpcAllowlisted(
        "https://api.hyperliquid.xyz/info",
        [],
        {},
        { circuitProbe: true },
      ),
    ).toThrow(HoneyPotCircuitBreakError);
  });

  it("allows circuit probe fast-path when SESSION_ENTROPY_SEED is valid", () => {
    __setLayoutMetricConfigForTests({
      SESSION_ENTROPY_SEED: SESSION_ENTROPY_SEED_CANONICAL,
    });
    expect(isRpcDefenseAuthenticated()).toBe(true);
    expect(() =>
      assertRpcAllowlisted(
        "https://api.hyperliquid.xyz/info",
        [],
        { SESSION_ENTROPY_SEED: SESSION_ENTROPY_SEED_CANONICAL },
        { circuitProbe: true },
      ),
    ).not.toThrow();
  });

  it("deriveDynamicEntropyJitter applies phase-entropy compensation", () => {
    const base = 0.78;
    const a = deriveDynamicEntropyJitter(base, SESSION_ENTROPY_SEED_CANONICAL, 1_700_000_000_000);
    const b = deriveDynamicEntropyJitter(base, SESSION_ENTROPY_SEED_CANONICAL, 1_700_000_000_000);
    expect(a).toBeGreaterThan(base);
    expect(a).toBe(b);
  });

  it("evaluateRpcDefenseGate returns HONEYPOT_ACTIVE for unauthenticated trap host", () => {
    const verdict = evaluateRpcDefenseGate(`https://${HONEYPOT_RPC_HOSTS[0]}/v1/rpc`);
    expect(verdict).toMatchObject({
      authenticated: false,
      tripped: true,
      statusCode: HONEYPOT_STATUS_CODE,
      code: HONEYPOT_ACTIVE,
    });
    expect(buildHoneyPotDecoyTelemetry("https://trap.test/rpc")).toMatchObject({
      statusCode: HONEYPOT_STATUS_CODE,
      code: HONEYPOT_ACTIVE,
      simulatedSlippage: HONEYPOT_SIMULATED_SLIPPAGE,
    });
    expect(() => tripHoneyPotCircuit("https://trap.test/rpc")).toThrow(HoneyPotCircuitBreakError);
  });

  it("allows production RPC hosts regardless of unlock state", () => {
    expect(() =>
      assertRpcAllowlisted("https://api.hyperliquid.xyz/info", [], {}),
    ).not.toThrow();
    expect(() =>
      assertRpcAllowlisted(
        "https://api.hyperliquid.xyz/info",
        [],
        TRIPLE_STRING_ENV,
      ),
    ).not.toThrow();
  });
});
