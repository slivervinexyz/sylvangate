import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUDITOR_ORACLE_LAG_NOTE,
  isGmxV2ExecutionHelpRequested,
  parseGmxV2ExecutionCli,
  printGmxV2ExecutionHelp,
  resolveGmxV2ExecutionPath,
  resolveOracleLagAuditorNote,
  validateGmxExecutionGuards,
} from "../../scripts/gmx-v2-execution-cli";
import {
  buildGmxV2UnsignedDepositPayload,
  buildGmxV2UnsignedOrderPayload,
  buildGmxV2UnsignedWithdrawPayload,
  GMX_ORDER_TYPE_INDEX,
} from "../../src/services/adapters/gmx-v2-order-payload";
import {
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
  buildArbitrumGasGuardMetrics,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
} from "../../src/services/risk/sequencer-guard";

afterEach(() => {
  __resetArbitrumGasGuardForTests();
  __resetSequencerGuardCacheForTests();
  vi.restoreAllMocks();
});

function armSequencerSafe(now = Date.now()): void {
  const sec = Math.floor(now / 1000);
  __setSequencerProbeForTests({
    answer: 0,
    startedAtSec: sec - 900,
    updatedAtSec: sec,
    fetchedAtMs: now,
    safe: true,
    reason: null,
  });
}

function armOracleLagDeadlock(now = Date.now()): void {
  armSequencerSafe(now);
  __setArbitrumGasGuardForTests({
    l1BaseFeeWei: 0n,
    l1SurchargeWei: 0n,
    l1SurchargeUsd: 0,
    targetYieldUsd: 0.1,
    gasYieldRatio: 0,
    gasBlocked: false,
    oracleUpdatedAtMs: 1_000,
    l2BlockTimestampMs: 32_000,
    oracleLagMs: 31_000,
    oracleLagDeadlock: true,
    reason: "ORACLE_LAG_DEADLOCK:31000ms>30000ms",
    fetchedAtMs: now,
  });
}

describe("gmx-v2-execution-cli", () => {
  it("isGmxV2ExecutionHelpRequested detects --help and -h", () => {
    expect(isGmxV2ExecutionHelpRequested(["--help"])).toBe(true);
    expect(isGmxV2ExecutionHelpRequested(["-h"])).toBe(true);
    expect(isGmxV2ExecutionHelpRequested(["--live-read"])).toBe(false);
  });

  it("printGmxV2ExecutionHelp documents --live-read, --allow-stale-oracle, and --help", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printGmxV2ExecutionHelp();
    const text = String(spy.mock.calls[0]?.[0]);
    expect(text).toContain("--live-read");
    expect(text).toContain("--allow-stale-oracle");
    expect(text).toContain("--reduce-only");
    expect(text).toContain("--withdraw");
    expect(text).toContain("-h, --help");
  });

  it("parseGmxV2ExecutionCli parses reduce-only and withdraw flags", () => {
    const decrease = parseGmxV2ExecutionCli(["--reduce-only", "--size", "250"]);
    expect(decrease.reduceOnly).toBe(true);
    expect(decrease.withdraw).toBe(false);
    expect(resolveGmxV2ExecutionPath(decrease)).toBe("decrease");

    const withdrawal = parseGmxV2ExecutionCli(["--withdraw", "--size", "100"]);
    expect(withdrawal.withdraw).toBe(true);
    expect(withdrawal.reduceOnly).toBe(false);
    expect(resolveGmxV2ExecutionPath(withdrawal)).toBe("withdraw");

    expect(() => parseGmxV2ExecutionCli(["--reduce-only", "--withdraw"])).toThrow(
      /INVALID_CLI_FLAGS/,
    );
  });

  it("parseGmxV2ExecutionCli parses live-read and allow-stale-oracle flags", () => {
    const cli = parseGmxV2ExecutionCli([
      "--live-read",
      "--allow-stale-oracle",
      "--symbol",
      "eth",
      "--size",
      "250",
      "--side",
      "long",
    ]);
    expect(cli.liveRead).toBe(true);
    expect(cli.allowStaleOracle).toBe(true);
    expect(cli.symbol).toBe("ETH");
    expect(cli.sizeUsd).toBe(250);
    expect(cli.side).toBe("long");
  });

  it("resolveOracleLagAuditorNote returns LIVE_DEFENSE_ACTIVE guidance on oracle lag block", () => {
    armOracleLagDeadlock();
    const gas = buildArbitrumGasGuardMetrics();
    const note = resolveOracleLagAuditorNote(
      ["ORACLE_LAG_DEADLOCK:31000ms>30000ms"],
      gas,
    );
    expect(note).toBe(AUDITOR_ORACLE_LAG_NOTE);
    expect(note).toContain("--allow-stale-oracle");
  });

  it("validateGmxExecutionGuards blocks on oracle lag without bypass", () => {
    armOracleLagDeadlock();
    const verdict = validateGmxExecutionGuards(false);
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join("|")).toContain("ORACLE_LAG");
  });

  it("validateGmxExecutionGuards bypasses oracle lag with --allow-stale-oracle", () => {
    armOracleLagDeadlock();
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const verdict = validateGmxExecutionGuards(true);
    expect(verdict.ok).toBe(true);
    expect(warn.mock.calls[0]?.[0]).toContain("[BYPASS_WARNING]");
    expect(warn.mock.calls[0]?.[0]).toContain("--allow-stale-oracle");
  });

  it("parseGmxV2ExecutionCli honors ALLOW_STALE_ORACLE=1 env", () => {
    const prev = process.env.ALLOW_STALE_ORACLE;
    process.env.ALLOW_STALE_ORACLE = "1";
    try {
      expect(parseGmxV2ExecutionCli([]).allowStaleOracle).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ALLOW_STALE_ORACLE;
      else process.env.ALLOW_STALE_ORACLE = prev;
    }
  });

  it("resolveGmxV2ExecutionPath drives decrease and withdraw dry-run payloads", () => {
    const marketToken = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";
    const decreaseCli = parseGmxV2ExecutionCli(["--reduce-only", "--size", "250"]);
    expect(resolveGmxV2ExecutionPath(decreaseCli)).toBe("decrease");
    const decrease = buildGmxV2UnsignedOrderPayload({
      side: "short",
      sizeUsd: decreaseCli.sizeUsd,
      reduceOnly: true,
      marketToken,
      midPriceUsd: 3500,
      skipFailClosedGuards: true,
    });
    expect(decrease.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketDecrease);

    const withdrawCli = parseGmxV2ExecutionCli(["--withdraw", "--size", "100"]);
    expect(resolveGmxV2ExecutionPath(withdrawCli)).toBe("withdraw");
    const withdraw = buildGmxV2UnsignedWithdrawPayload({
      marketToken,
      sizeUsd: withdrawCli.sizeUsd,
      skipFailClosedGuards: true,
    });
    expect(withdraw.action).toBe("withdraw");

    const defaultCli = parseGmxV2ExecutionCli([]);
    expect(resolveGmxV2ExecutionPath(defaultCli)).toBe("increase-deposit");
    const increase = buildGmxV2UnsignedOrderPayload({
      side: defaultCli.side,
      sizeUsd: defaultCli.sizeUsd,
      marketToken,
      midPriceUsd: 3500,
      skipFailClosedGuards: true,
    });
    const deposit = buildGmxV2UnsignedDepositPayload({
      marketToken,
      sizeUsd: defaultCli.sizeUsd,
    });
    expect(increase.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketIncrease);
    expect(deposit.action).toBe("deposit");
  });
});
