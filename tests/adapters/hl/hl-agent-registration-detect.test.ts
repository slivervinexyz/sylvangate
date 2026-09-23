import { describe, expect, it } from "vitest";
import {
  extractHlExchangeErrorDetail,
  isHlAgentAlreadyUsedError,
  isHlTelemetryFallbackError,
  isHlUserWalletMissingError,
} from "../../../src/adapters/hl/hl-agent-registration";
import { HyperliquidExecutionError } from "../../../src/adapters/hl/execution-types";

describe("hl-agent-registration — error detection", () => {
  it("detects HL user wallet missing errors", () => {
    expect(
      isHlUserWalletMissingError("User or API Wallet 0xabc does not exist."),
    ).toBe(true);
    expect(isHlUserWalletMissingError("Insufficient margin")).toBe(false);
  });

  it("isHlTelemetryFallbackError includes wallet missing and timeouts", () => {
    expect(
      isHlTelemetryFallbackError("User or API Wallet 0xabc does not exist."),
    ).toBe(true);
    expect(isHlTelemetryFallbackError("Hyperliquid exchange request timed out")).toBe(
      true,
    );
    expect(isHlTelemetryFallbackError("Insufficient margin")).toBe(false);
  });

  it("extractHlExchangeErrorDetail reads HyperliquidExecutionError body", () => {
    const detail = extractHlExchangeErrorDetail(
      new HyperliquidExecutionError(
        "reject",
        "EXECUTION_REJECT",
        200,
        { status: "err", response: "User or API Wallet 0xabc does not exist." },
      ),
    );
    expect(detail).toBe("User or API Wallet 0xabc does not exist.");
  });

  it("isHlAgentAlreadyUsedError detects reuse rejection", () => {
    expect(isHlAgentAlreadyUsedError("Extra agent already used")).toBe(true);
    expect(isHlAgentAlreadyUsedError("Insufficient margin")).toBe(false);
  });
});
