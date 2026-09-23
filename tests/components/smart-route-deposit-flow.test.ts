import { describe, expect, it } from "vitest";
import {
  runArbitrumNativeDepositPreview,
  runDepositPreviewByTranche,
  runSmartRouteDepositPreview,
} from "../../src/lib/gui-bridge/grant-audit/smart-route-deposit-flow";

const WALLET = "0xcccccccccccccccccccccccccccccccccccccccc";
const NOW = 1_700_000_000_000;

describe("smart-route-deposit-flow", () => {
  it("runs deposit → soil → gate payloadHash preview without error", () => {
    const preview = runSmartRouteDepositPreview({ amountUsd: 1_000, wallet: WALLET });
    expect(preview.ok).toBe(true);
    expect(preview.phase).toBe("ready");
    expect(preview.gateSimVerdict).toBe("ALLOW");
    expect(preview.soilTripped).toBe(false);
    expect(preview.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(preview.smartRoutingAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("fail-closes smart-route preview on in-flight bridge capital", () => {
    const preview = runSmartRouteDepositPreview({
      amountUsd: 1_000,
      wallet: WALLET,
      initiatedAtMs: NOW,
      settledAtMs: null,
      nowMs: NOW + 30_000,
    });
    expect(preview.ok).toBe(false);
    expect(preview.gateSimVerdict).toBe("DENY");
    expect(preview.payloadHash).toBeNull();
    expect(preview.reasons).toContain("IN_FLIGHT_BRIDGE_CAPITAL");
  });

  it("fail-closes on undersized deposit", () => {
    const preview = runSmartRouteDepositPreview({ amountUsd: 1, wallet: WALLET });
    expect(preview.ok).toBe(false);
    expect(preview.gateSimVerdict).toBe("DENY");
    expect(preview.payloadHash).toBeNull();
  });

  it("Tranche A native preview binds payloadHash on Arbitrum path", () => {
    const preview = runArbitrumNativeDepositPreview({ amountUsd: 500, wallet: WALLET });
    expect(preview.ok).toBe(true);
    expect(preview.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("runDepositPreviewByTranche dispatches Tranche A vs Tranche B", () => {
    const native = runDepositPreviewByTranche({
      tranche: "tranche-a-native",
      amountUsd: 500,
      wallet: WALLET,
    });
    const escort = runDepositPreviewByTranche({
      tranche: "tranche-b-robinhood",
      amountUsd: 500,
      wallet: WALLET,
    });
    expect(native.ok).toBe(true);
    expect(escort.ok).toBe(true);
    expect(native.smartRoutingAddress).not.toBe(escort.smartRoutingAddress);
  });
});
