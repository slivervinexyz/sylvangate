import { describe, expect, it } from "vitest";
import { HyperliquidExecutionError } from "../../../src/adapters/hl/execution-types";
import { unwrapHlError } from "../../../src/adapters/hl/error-unwrap";

describe("unwrapHlError", () => {
  it("unwraps HyperliquidExecutionError body messages", () => {
    const err = new HyperliquidExecutionError(
      "Hyperliquid execution rejected",
      "EXECUTION_REJECT",
      400,
      { response: "Insufficient margin" },
    );
    expect(unwrapHlError(err)).toBe("Insufficient margin");
  });

  it("JSON-stringifies plain wallet reject objects", () => {
    expect(unwrapHlError({ code: 4001, message: "User rejected" })).toBe(
      "User rejected",
    );
    expect(unwrapHlError({ code: 4001 })).toBe('{"code":4001}');
  });
});
