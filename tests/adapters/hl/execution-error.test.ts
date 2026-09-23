import { describe, expect, it } from "vitest";
import { HyperliquidExecutionError } from "../../../src/adapters/hl/execution";

describe("hl/execution — HyperliquidExecutionError shape", () => {
  it("exposes code and httpStatus", () => {
    const err = new HyperliquidExecutionError("test", "RATE_LIMIT", 429);
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.httpStatus).toBe(429);
  });
});
