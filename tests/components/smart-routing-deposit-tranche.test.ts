import { describe, expect, it } from "vitest";
import {
  DEPOSIT_TRANCHE_B,
  DEPOSIT_TRANCHE_OPTIONS,
  resolveDepositTrancheConfig,
} from "../../src/lib/gui-bridge/deposit-tranche-config";

describe("deposit-tranche-config", () => {
  it("defines segregated tranche A/B options", () => {
    expect(DEPOSIT_TRANCHE_OPTIONS).toHaveLength(2);
    expect(DEPOSIT_TRANCHE_OPTIONS.map((o) => o.id)).toEqual([
      "tranche-a-native",
      "tranche-b-robinhood",
    ]);
  });

  it("Tranche B encodes outbound-only Robinhood bridge state machine", () => {
    expect(DEPOSIT_TRANCHE_B.id).toBe("tranche-b-robinhood");
    expect(DEPOSIT_TRANCHE_B.bridgeStateMachine.join(" ")).toContain(
      "BRIDGE_TIMEOUT_FAIL_CLOSED",
    );
    expect(resolveDepositTrancheConfig("tranche-b-robinhood").sendChain).toBe(
      "rh-4663",
    );
  });
});
