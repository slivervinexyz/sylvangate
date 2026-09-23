import { describe, expect, it } from "vitest";
import { buildSystemState } from "../src/services/systemState";
import {
  criticalKvFlagsEqual,
  extractCriticalKvFlags,
  matrixSensorFingerprint,
  shouldPersistMatrixPayloadToKv,
  shouldPersistSystemStateToKv,
} from "../src/services/stateManager";

describe("stateManager — KV delta gate", () => {
  it("extractCriticalKvFlags maps equilibriumMode, circuitBreaker, rootProtection", () => {
    const state = buildSystemState({
      currentCri: 100,
      skipHardlockAssert: true,
      soilTripped: false,
      isHedgeActive: false,
    });
    const flags = extractCriticalKvFlags(state);
    expect(flags).not.toBeNull();
    expect(flags!.equilibriumMode).toBeTruthy();
    expect(flags!.circuitBreaker).toBe(false);
    expect(flags!.rootProtection).toBe(false);
    expect(flags!.currentCri).toBe(100);
  });

  it("shouldPersistSystemStateToKv skips when critical flags unchanged", () => {
    const a = buildSystemState({ currentCri: 100, skipHardlockAssert: true });
    const b = buildSystemState({ currentCri: 100, skipHardlockAssert: true });
    expect(shouldPersistSystemStateToKv(a, b)).toBe(false);
  });

  it("shouldPersistSystemStateToKv writes when rootProtection trips", () => {
    const safe = buildSystemState({ currentCri: 100, skipHardlockAssert: true });
    const locked = buildSystemState({ currentCri: 0, skipHardlockAssert: true });
    expect(shouldPersistSystemStateToKv(safe, locked)).toBe(true);
  });

  it("shouldPersistSystemStateToKv writes when circuitBreaker trips", () => {
    const open = buildSystemState({ currentCri: 100, skipHardlockAssert: true });
    const severed = { ...open, signingChannelOpen: false };
    expect(shouldPersistSystemStateToKv(open, severed)).toBe(true);
  });

  it("criticalKvFlagsEqual compares full slice", () => {
    const a = extractCriticalKvFlags(
      buildSystemState({ currentCri: 80, skipHardlockAssert: true }),
    )!;
    const b = extractCriticalKvFlags(
      buildSystemState({ currentCri: 80, skipHardlockAssert: true }),
    )!;
    expect(criticalKvFlagsEqual(a, b)).toBe(true);
  });

  it("matrixSensorFingerprint skips identical funding payloads", () => {
    const payload = {
      matrix: [{ b1_symbol: "BTC" }],
      funding_rate_kings: { highest: { symbol: "SOL", rate8h_pct: 1.2 } },
      vix_traditional: 16.8,
      dvol_crypto: 52.5,
    };
    expect(shouldPersistMatrixPayloadToKv(payload, payload)).toBe(false);
    expect(
      shouldPersistMatrixPayloadToKv(payload, {
        ...payload,
        funding_rate_kings: { highest: { symbol: "ETH", rate8h_pct: 2.1 } },
      }),
    ).toBe(true);
    expect(matrixSensorFingerprint(null)).toBeNull();
  });
});
