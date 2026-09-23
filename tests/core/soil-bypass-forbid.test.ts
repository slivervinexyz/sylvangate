import { afterEach, describe, expect, it } from "vitest";
import {
  assertSoilProbeBypassForbidden,
  shouldBypassOracleLagDeadlock,
} from "../../src/core/soil-resistance-core";
import { requireGateSignerForGmxFill } from "../../scripts/gmx-micro-fill-gate";
import { isLiveHarnessBypassArmed } from "../../scripts/_shared/live-harness-warning";

describe("soil / Gate bypass forbidden", () => {
  afterEach(() => {
    delete process.env.BYPASS_SOIL_PROBE;
    delete process.env.ALLOW_STALE_ORACLE;
  });

  it("BYPASS_SOIL_PROBE no longer bypasses oracle-lag deadlock", () => {
    process.env.BYPASS_SOIL_PROBE = "true";
    expect(shouldBypassOracleLagDeadlock()).toBe(false);
  });

  it("assertSoilProbeBypassForbidden throws when BYPASS_SOIL_PROBE=true", () => {
    process.env.BYPASS_SOIL_PROBE = "true";
    expect(() => assertSoilProbeBypassForbidden()).toThrow(/SOIL_BYPASS_FORBIDDEN/);
  });

  it("ALLOW_STALE_ORACLE still arms stale-oracle override only", () => {
    process.env.ALLOW_STALE_ORACLE = "1";
    expect(shouldBypassOracleLagDeadlock()).toBe(true);
    expect(isLiveHarnessBypassArmed()).toBe(true);
  });

  it("requireGateSignerForGmxFill fail-closes without registered signer", () => {
    expect(() => requireGateSignerForGmxFill(null)).toThrow(/GATE_CONSUME_REQUIRED/);
  });
});
