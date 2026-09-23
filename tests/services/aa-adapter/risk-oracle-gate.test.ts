import { describe, expect, it } from "vitest";
import { RiskLimitExceeded } from "../../../src/services/risk-control";
import {
  assertRiskOracleUserOpGate,
  evaluateRiskOracleUserOpGate,
  isRiskOracleUserOpBlocked,
  RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
  RISK_ORACLE_FAIL_CLOSED_TRIP,
  shouldEnforceRiskOracleGate,
} from "../../../src/services/aa-adapter/risk-oracle-gate";

describe("risk-oracle-gate", () => {
  it("allows UserOp when oracle is nominal", () => {
    expect(
      evaluateRiskOracleUserOpGate({ isSystemFlushed: false, statusCode: 0 }),
    ).toEqual({ allowed: true });
    expect(isRiskOracleUserOpBlocked({ isSystemFlushed: false, statusCode: 1 })).toBe(false);
  });

  it("blocks UserOp when isSystemFlushed is true", () => {
    expect(() =>
      assertRiskOracleUserOpGate({ isSystemFlushed: true, statusCode: 3 }),
    ).toThrow(RiskLimitExceeded);

    try {
      assertRiskOracleUserOpGate({ isSystemFlushed: true, statusCode: 3 });
    } catch (err) {
      expect(err).toBeInstanceOf(RiskLimitExceeded);
      expect((err as RiskLimitExceeded).message).toContain(RISK_ORACLE_FAIL_CLOSED_TRIP);
    }
  });

  it("blocks UserOp when statusCode === 3 even if flush flag is false", () => {
    expect(() =>
      assertRiskOracleUserOpGate({
        isSystemFlushed: false,
        statusCode: RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
      }),
    ).toThrow(RiskLimitExceeded);
  });

  it("enforces gate only when USE_ZERODEV_AA and oracle address are set", () => {
    expect(
      shouldEnforceRiskOracleGate({
        USE_ZERODEV_AA: "true",
        SLIVERVINE_RISK_ORACLE_ADDRESS: "0x1111111111111111111111111111111111111111",
      }),
    ).toBe(true);
    expect(
      shouldEnforceRiskOracleGate({
        USE_ZERODEV_AA: "true",
        SILVERVINE_RISK_ORACLE_ADDRESS: "0x2222222222222222222222222222222222222222",
      }),
    ).toBe(true);
    expect(shouldEnforceRiskOracleGate({ USE_ZERODEV_AA: "false" })).toBe(false);
    expect(shouldEnforceRiskOracleGate({ USE_ZERODEV_AA: "true" })).toBe(false);
  });
});
