import { describe, expect, it, vi } from "vitest";
import {
  evaluateComplianceAdapter,
  evaluateRiskOracleAdapter,
  isWarningStatus,
  mirrorRiskOracleLog,
  RISK_ORACLE_LOG_CODES,
  RISK_ORACLE_STATUS,
} from "../../../src/services/aa-adapter/risk-oracle-adapter";

describe("risk-oracle-adapter", () => {
  it("allows SAFE and WARNING; blocks SHUTDOWN / flushed", () => {
    expect(evaluateRiskOracleAdapter({ isSystemFlushed: false, statusCode: RISK_ORACLE_STATUS.SAFE }).allowed).toBe(
      true,
    );
    expect(
      evaluateRiskOracleAdapter({ isSystemFlushed: false, statusCode: RISK_ORACLE_STATUS.WARNING }).allowed,
    ).toBe(true);
    expect(isWarningStatus(RISK_ORACLE_STATUS.WARNING)).toBe(true);

    const shutdown = evaluateRiskOracleAdapter({
      isSystemFlushed: false,
      statusCode: RISK_ORACLE_STATUS.SHUTDOWN,
    });
    expect(shutdown.allowed).toBe(false);
    expect(shutdown.logCode).toBe(RISK_ORACLE_LOG_CODES.SLO_TIMEOUT);

    const flushed = evaluateRiskOracleAdapter({ isSystemFlushed: true, statusCode: 0 });
    expect(flushed.allowed).toBe(false);
    expect(flushed.logCode).toBe(RISK_ORACLE_LOG_CODES.SLO_TIMEOUT);
  });

  it("compliance adapter blocks filter miss with INVALID_SIGNER log code", () => {
    const verdict = evaluateComplianceAdapter({
      oracle: { isSystemFlushed: false, statusCode: RISK_ORACLE_STATUS.SAFE },
      target: "0x1111111111111111111111111111111111111111",
      targetCompliant: false,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.logCode).toBe(RISK_ORACLE_LOG_CODES.INVALID_SIGNER);
  });

  it("mirrorRiskOracleLog emits console warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mirrorRiskOracleLog(RISK_ORACLE_LOG_CODES.INVALID_SIGNER, "0xabc");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("INVALID_SIGNER"),
    );
    spy.mockRestore();
  });
});
