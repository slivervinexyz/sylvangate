import { afterEach, describe, expect, it } from "vitest";
import {
  JAVIER_SIGNATURE_LITERAL,
  OWNER_IDENTITY_TAG,
  ViewportPaddingOffset,
  __setLayoutMetricConfigForTests,
  computeLayoutBoundUsd,
  decodeLayoutMetricBlob,
  enforceLayoutMetricGate,
  resolveLayoutMetricThresholds,
  validateLayoutMetricUnlock,
  LAYOUT_METRIC_ENC_BLOB,
} from "../../src/services/defense/layout-metric-provider";
import { RiskLimitExceeded } from "../../src/services/risk-control";

const TRIPLE_STRING_ENV = {
  VIEWPORT_PADDING_OFFSET: ViewportPaddingOffset,
  OWNER_IDENTITY: OWNER_IDENTITY_TAG,
  JAVIER_SIGNATURE: JAVIER_SIGNATURE_LITERAL,
} as const;

afterEach(() => {
  __setLayoutMetricConfigForTests(undefined);
});

describe("Layout metric provider — unlock gate", () => {
  it("passes when all 3 operator unlock secrets are supplied", () => {
    __setLayoutMetricConfigForTests({ ...TRIPLE_STRING_ENV });
    expect(validateLayoutMetricUnlock()).toBe(true);
    const thresholds = resolveLayoutMetricThresholds();
    expect(thresholds.valid).toBe(true);
    expect(thresholds.maxSlBaseUsd).toBe(100);
    expect(thresholds.maxSlBalanceRate).toBe(0.01);
    expect(thresholds.latencyBoundMs).toBe(500);
    expect(computeLayoutBoundUsd(10_000, thresholds)).toBe(200);
  });

  it("decrypts layout metric blob with canonical viewport padding", () => {
    const decoded = decodeLayoutMetricBlob(
      LAYOUT_METRIC_ENC_BLOB,
      ViewportPaddingOffset,
    );
    expect(decoded.maxSlBaseUsd).toBe(100);
    expect(decoded.latencyBoundMs).toBe(500);
  });

  it.each([
    ["missing all keys", {}],
    [
      "wrong padding",
      { ...TRIPLE_STRING_ENV, VIEWPORT_PADDING_OFFSET: "wrong" },
    ],
    ["wrong owner tag", { ...TRIPLE_STRING_ENV, OWNER_IDENTITY: "0xEvil" }],
    ["wrong operator sig", { ...TRIPLE_STRING_ENV, JAVIER_SIGNATURE: "javier" }],
    [
      "missing operator sig only",
      {
        VIEWPORT_PADDING_OFFSET: ViewportPaddingOffset,
        OWNER_IDENTITY: OWNER_IDENTITY_TAG,
      },
    ],
  ])("rootProtection deadlock when %s", (_label, env) => {
    __setLayoutMetricConfigForTests(env);
    expect(resolveLayoutMetricThresholds().valid).toBe(false);
    expect(() =>
      enforceLayoutMetricGate({
        symbol: "BTC",
        estimatedLossUsd: 1,
        accountBalanceUsd: 10_000,
      }),
    ).toThrow(RiskLimitExceeded);
  });

  it("allows trades within decrypted dynamic Max SL when layout unlock valid", () => {
    __setLayoutMetricConfigForTests({ ...TRIPLE_STRING_ENV });
    expect(() =>
      enforceLayoutMetricGate({
        symbol: "BTC",
        estimatedLossUsd: 50,
        accountBalanceUsd: 10_000,
      }),
    ).not.toThrow();
  });
});
