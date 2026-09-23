import { describe, expect, it } from "vitest";
import {
  BRIDGE_TIMEOUT_FAIL_CLOSED,
  COMPLIANCE_TRIP_ALERTS,
  ORACLE_LAG_DEADLOCK,
  SYSTEM_FAIL_CLOSED_TRIP,
  resolveComplianceAlertsFromReasons,
} from "../../src/lib/gui-bridge/compliance-trip-alerts";

describe("compliance-trip-alerts", () => {
  it("resolves SYSTEM_FAIL_CLOSED_TRIP from signing channel severance", () => {
    const alerts = resolveComplianceAlertsFromReasons([
      "SYSTEM_FAIL_CLOSED_TRIP:signingChannelOpen=false",
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.code).toBe(SYSTEM_FAIL_CLOSED_TRIP);
    expect(alerts[0]?.message).toContain("tradeAllowed: false");
  });

  it("resolves BRIDGE_TIMEOUT_FAIL_CLOSED from bridge state machine", () => {
    const alerts = resolveComplianceAlertsFromReasons([
      "BRIDGE_TIMEOUT_FAIL_CLOSED:3600001ms>3600000ms",
    ]);
    expect(alerts[0]?.code).toBe(BRIDGE_TIMEOUT_FAIL_CLOSED);
    expect(alerts[0]?.message).toContain("lostUsd ≡ 0");
  });

  it("resolves ORACLE_LAG_DEADLOCK from oracle staleness reason", () => {
    const alerts = resolveComplianceAlertsFromReasons([
      "ORACLE_LAG_DEADLOCK:31000ms>30000ms",
    ]);
    expect(alerts[0]?.code).toBe(ORACLE_LAG_DEADLOCK);
    expect(alerts[0]?.message).toContain(">30s");
  });

  it("exposes stable alert copy for all trip codes", () => {
    expect(Object.keys(COMPLIANCE_TRIP_ALERTS).sort()).toEqual(
      [
        BRIDGE_TIMEOUT_FAIL_CLOSED,
        ORACLE_LAG_DEADLOCK,
        SYSTEM_FAIL_CLOSED_TRIP,
      ].sort(),
    );
  });
});
