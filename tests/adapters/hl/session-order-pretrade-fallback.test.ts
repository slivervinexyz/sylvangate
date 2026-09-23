import { describe, expect, it } from "vitest";
import { PreTradeValidationError } from "../../../src/adapters/hl/execution-types";
import {
  isPreTradeValidationDeferredError,
  PRETRADE_TELEMETRY_FALLBACK_WARN_LOG,
} from "../../../src/adapters/hl/wallet/sessionOrderFallback";

describe("session order pre-trade telemetry fallback", () => {
  it("PRETRADE_TELEMETRY_FALLBACK_WARN_LOG matches deferred pipeline message", () => {
    expect(PRETRADE_TELEMETRY_FALLBACK_WARN_LOG).toBe(
      "[WARN] Pre-trade validation deferred -> Switching to Telemetry Proof Pipeline",
    );
  });

  it("isPreTradeValidationDeferredError detects PreTradeValidationError instances", () => {
    const err = new PreTradeValidationError(
      "Pre-trade validation failed — execution blocked",
      ["LATENCY_MS=999"],
    );
    expect(isPreTradeValidationDeferredError(err.message, err)).toBe(true);
  });

  it("isPreTradeValidationDeferredError detects soil gate trip messages", () => {
    expect(
      isPreTradeValidationDeferredError(
        "checkSoilResistance() TRIPPED — DEPTH_USD=4000<5000",
      ),
    ).toBe(true);
    expect(isPreTradeValidationDeferredError("Insufficient margin")).toBe(false);
  });
});
