import { describe, expect, it } from "vitest";
import {
  executeHyperliquidOrder,
  resolveDryRunFromEnv,
  validateProductionSessionKeyBridge,
  validateSessionKeySignatureFormat,
} from "../src/adapters/hyperliquid-adapter";
import { BASE_ORDER, PASSING_SOIL } from "./backend-finalization-lib/fixtures";

describe("hyperliquid-adapter DRY_RUN bridge", () => {
  it("forces dry-run when HL_DRY_RUN env flag is set", () => {
    expect(resolveDryRunFromEnv({ HL_DRY_RUN: "true" }, { privateKey: "0xabc" })).toBe(
      true,
    );
  });

  it("executes mock fill under HL_DRY_RUN without production signature gate", async () => {
    const result = await executeHyperliquidOrder(
      {
        payload: BASE_ORDER,
        soil: PASSING_SOIL,
        sessionExpiryTimestamp: Date.now() - 1,
        config: { privateKey: "0xabc" },
      },
      { HL_DRY_RUN: "true" },
    );
    expect(result.dryRun).toBe(true);
    expect(result.success).toBe(true);
  });

  it("validates session key signature format in production mode", async () => {
    const future = Date.now() + 600_000;
    const gate = await validateProductionSessionKeyBridge(
      BASE_ORDER,
      future,
      false,
    );
    expect(gate.ok).toBe(true);
    expect(validateSessionKeySignatureFormat("0x" + "a".repeat(64))).toBe(true);
    expect(validateSessionKeySignatureFormat("bad-sig")).toBe(false);
  });
});
