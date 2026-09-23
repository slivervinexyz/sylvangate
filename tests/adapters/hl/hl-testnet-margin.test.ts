import { describe, expect, it } from "vitest";
import {
  fetchHlTestnetPerpsMargin,
  formatInsufficientTestnetMarginWarn,
  formatMarginLowProceedWarnLog,
  isPerpsEquityFunded,
  parseHlPerpsMarginSnapshot,
  shouldBlockLive5TxForMargin,
  shouldWarnMarginPreflight,
} from "../../../src/adapters/hl/hl-testnet-margin";
import { loadVerified5TxResults } from "../../../src/data/verified-5tx";
import {
  buildBatchConsoleHydrationLogs,
  createBatchFromLiveResults,
} from "../../../src/lib/gui-bridge/section1-hud-engine";

describe("hl-testnet-margin preflight", () => {
  it("parseHlPerpsMarginSnapshot reads marginSummary.accountValue", () => {
    const snapshot = parseHlPerpsMarginSnapshot({
      marginSummary: { accountValue: "299.00" },
      withdrawable: "12.5",
    });
    expect(snapshot.accountValueUsd).toBe(299);
    expect(snapshot.withdrawableUsd).toBe(12.5);
    expect(isPerpsEquityFunded(snapshot)).toBe(true);
  });

  it("isPerpsEquityFunded requires marginSummary.accountValue > 0", () => {
    expect(
      isPerpsEquityFunded({
        accountValueUsd: 299,
        withdrawableUsd: 0,
        apiOk: true,
      }),
    ).toBe(true);
    expect(
      isPerpsEquityFunded({
        accountValueUsd: 0,
        withdrawableUsd: 50,
        apiOk: true,
      }),
    ).toBe(false);
  });

  it("shouldBlockLive5TxForMargin is always non-blocking", () => {
    expect(
      shouldBlockLive5TxForMargin({
        accountValueUsd: 0,
        withdrawableUsd: 0,
        apiOk: true,
      }),
    ).toBe(false);
  });

  it("shouldWarnMarginPreflight when equity zero or API unavailable", () => {
    expect(
      shouldWarnMarginPreflight({
        accountValueUsd: 0,
        withdrawableUsd: 0,
        apiOk: true,
      }),
    ).toBe(true);
    expect(
      shouldWarnMarginPreflight({
        accountValueUsd: 299,
        withdrawableUsd: 0,
        apiOk: true,
      }),
    ).toBe(false);
    expect(
      shouldWarnMarginPreflight({
        accountValueUsd: 0,
        withdrawableUsd: 0,
        apiOk: false,
      }),
    ).toBe(true);
  });

  it("formatMarginLowProceedWarnLog matches HUD copy", () => {
    expect(formatMarginLowProceedWarnLog(0)).toBe(
      "LIVE_5TX: Margin low (0 USDC), proceeding with Session Key EIP-712 signature request...",
    );
  });

  it("fetchHlTestnetPerpsMargin warns on API failure without blocking", async () => {
    const snapshot = await fetchHlTestnetPerpsMargin("0xabc", async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as typeof fetch);
    expect(snapshot.apiOk).toBe(false);
    expect(shouldWarnMarginPreflight(snapshot)).toBe(true);
    expect(shouldBlockLive5TxForMargin(snapshot)).toBe(false);
  });

  it("formatInsufficientTestnetMarginWarn matches HUD copy", () => {
    expect(formatInsufficientTestnetMarginWarn(0)).toBe(
      "LIVE_5TX: Insufficient Testnet Margin (0 USDC). Please claim Faucet at app.hyperliquid-testnet.xyz.",
    );
  });
});

describe("batch console hydration", () => {
  it("buildBatchConsoleHydrationLogs includes all 5 tx hashes and TCA anchor", () => {
    const batch = createBatchFromLiveResults(1, loadVerified5TxResults());
    const logs = buildBatchConsoleHydrationLogs(batch);
    expect(logs.some((l) => l.message.startsWith("TCA_ANCHOR: SHA-256"))).toBe(true);
    expect(logs.filter((l) => l.message.includes("BATCH_FILL")).length).toBe(5);
    expect(logs.some((l) => l.message.includes("TxHash:"))).toBe(true);
  });
});
