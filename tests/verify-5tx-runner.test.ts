import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidFillTxHash } from "../src/data/verified-5tx";
import { runVerify5Tx } from "../src/data/verify-5tx-runner";
import { SAFE_TRADING_TIME } from "./helpers/system-time";

vi.mock("../src/adapters/hl/session-key-executor", () => ({
  executeHlSessionKeyOrder: vi.fn(async () => ({
    ok: true,
    dryRun: true,
    filledUsd: 10,
    reduceOnly: false,
  })),
}));

describe("runVerify5Tx dry-run", () => {
  beforeEach(() => {
    vi.setSystemTime(SAFE_TRADING_TIME);
  });

  it(
    "executes 5 dry-run orders offline without live HL RPC",
    async () => {
      const fetchFn = vi.fn(async () =>
        Response.json({
          coin: "ETH",
          levels: [
            [{ px: "3499", sz: "100" }],
            [{ px: "3501", sz: "100" }],
          ],
        }),
      );

      const report = await runVerify5Tx({
        live: false,
        fetchFn: fetchFn as typeof fetch,
      });

      expect(report.fills).toHaveLength(5);
      expect(report.dryRun).toBe(true);
      expect(report.fills[0]!.explorerUrl).toContain(
        "app.hyperliquid-testnet.xyz/explorer/tx/",
      );
      expect(report.aggregate.sampleCount).toBe(5);
      expect(report.soilAudit?.ok).toBe(true);
      expect(fetchFn).not.toHaveBeenCalled();
    },
    5_000,
  );

  it("generates unique dry-run hashes per fill and per execution", async () => {
    const reportA = await runVerify5Tx({ live: false });
    const reportB = await runVerify5Tx({ live: false });
    const hashesA = reportA.fills.map((fill) => fill.txHash);
    const hashesB = reportB.fills.map((fill) => fill.txHash);
    expect(new Set(hashesA).size).toBe(5);
    expect(new Set([...hashesA, ...hashesB]).size).toBe(10);
    for (const hash of hashesA) {
      expect(isValidFillTxHash(hash)).toBe(true);
    }
  });
});
