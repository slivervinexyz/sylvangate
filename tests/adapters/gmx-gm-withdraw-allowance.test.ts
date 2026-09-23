import { describe, expect, it } from "vitest";
import { isGmxGmWithdrawAllowanceSufficient } from "../../src/services/adapters/gmx-gm-withdraw-allowance";

describe("gmx-gm-withdraw-allowance", () => {
  it("isGmxGmWithdrawAllowanceSufficient requires allowance >= gmTokenAmount", () => {
    const required = 1_060_000_000_000_000_000n;
    expect(isGmxGmWithdrawAllowanceSufficient(required, required)).toBe(true);
    expect(isGmxGmWithdrawAllowanceSufficient(required + 1n, required)).toBe(true);
    expect(isGmxGmWithdrawAllowanceSufficient(1_000_000_000_000_000_000n, required)).toBe(false);
    expect(isGmxGmWithdrawAllowanceSufficient(1n, required)).toBe(false);
    expect(isGmxGmWithdrawAllowanceSufficient(0n, required)).toBe(false);
  });
});
