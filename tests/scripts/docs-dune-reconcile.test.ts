import { describe, expect, it } from "vitest";
import {
  buildRollupJson,
  rollupExomeshCsv,
  rollupSepsbCsv,
  scanPublicDocStaleKpis,
  scanSpecDocDrift,
  validateExomeshRows,
} from "../../scripts/_shared/dune-reconcile-lib";
import {
  rollupOnchainCsv,
  validateOnchainRows,
} from "../../scripts/_shared/dune-reconcile-onchain";
import { formatOnchainDuneCsv, mapOnchainLogToDuneRow } from "../../scripts/_shared/onchain-dune-telemetry";
import { parseDuneTelemetryCsv } from "../../scripts/_shared/exomesh-dune-telemetry-cumulative";

const MINI_CSV = `# silvervine.exomesh.dune-telemetry.v1
timestamp,venue,intercept_type,reflex_latency_us,gas_burned,simulated_loss_prevented_usd,gas_saved_usd,status
2026-09-14T03:13:27.287Z,gmx,SOIL_RESISTANCE_TRIP,2.5,0.000000,6340.00,0.25,FAIL_CLOSED
2026-09-14T03:19:14.275Z,pendle,MAX_ATTEMPTS_SEVERED,10.3,0.000000,40515.00,0.25,FAIL_CLOSED
2026-09-14T04:22:51.142Z,gmx,ALLOW,1.3,0.000001,0.00,0.00,ALLOW
`;

describe("docs-dune-reconcile lib", () => {
  it("rolls up exomesh CSV totals", () => {
    const rollup = rollupExomeshCsv(MINI_CSV, "/tmp/exomesh.csv");
    expect(rollup.total_rows).toBe(3);
    expect(rollup.fail_closed_count).toBe(2);
    expect(rollup.allow_count).toBe(1);
    expect(rollup.simulated_loss_prevented_usd_total).toBe(46855);
    expect(rollup.gas_saved_usd_total).toBe(0.5);
    expect(rollup.intercept_type_breakdown.SOIL_RESISTANCE_TRIP.count).toBe(1);
  });

  it("validates FAIL_CLOSED gas_burned = 0", () => {
    const rows = parseDuneTelemetryCsv(MINI_CSV);
    expect(validateExomeshRows(rows)).toEqual([]);
  });

  it("detects spec doc drift for stale $6.57M", () => {
    const spec = "| 2 | Counter | **$6.57M** — `SUM(simulated_loss_prevented_usd)` |";
    const rollup = rollupExomeshCsv(MINI_CSV, "/tmp/exomesh.csv");
    const violations = scanSpecDocDrift(spec, rollup);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("6.57M");
  });

  it("flags stale public doc KPI phrases", () => {
    const violations = scanPublicDocStaleKpis(
      "README.md",
      "live off-chain pre-consensus volume · Dune Live Telemetry Dashboard · daily cumulative append",
    );
    expect(violations.length).toBe(3);
  });

  it("skips demoted copy reference doc for Total Capital Protected", () => {
    const violations = scanPublicDocStaleKpis(
      "docs/01_architecture_and_standards/03_telemetry_and_mo/DUNE_DASHBOARD_COPY_DEMOTED.md",
      "Old label: Total Capital Protected",
    );
    expect(violations).toEqual([]);
  });

  it("rolls up sepsb latency percentiles", () => {
    const csv = `case_id,set_type,venue,expected_verdict,actual_verdict,is_correct,reflex_latency_us,tpr_rate,fpr_rate,hardware_spec,timestamp
a,toxic,gmx,block,block,true,10.0,100.0,0.0,cpu,2026-09-15T03:25:27.710Z
b,toxic,gmx,block,block,true,30.0,100.0,0.0,cpu,2026-09-15T03:25:27.710Z`;
    const rollup = rollupSepsbCsv(csv);
    expect(rollup.case_count).toBe(2);
    expect(rollup.min_latency_us).toBe(10);
    expect(rollup.p50_latency_us).toBe(10);
    expect(rollup.tpr_pct).toBe(100);
  });

  it("rolls up onchain CSV with tx_hash and does not affect exomesh totals", () => {
    const onchainRow = mapOnchainLogToDuneRow({
      chainId: 421614,
      network: "sepolia",
      blockNumber: 100n,
      transactionHash: "0xdeadbeef",
      logIndex: 2,
      timestampMs: Date.parse("2026-09-13T00:00:00.000Z"),
      gasUsed: 50_000n,
      gasPriceWei: 1_000_000_000n,
      eventName: "RiskTripBlocked",
      intentHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      agent: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      reason: "SOIL_RESISTANCE_TRIP",
    });
    const onchainCsv = formatOnchainDuneCsv([onchainRow]);
    const onchain = rollupOnchainCsv(onchainCsv);
    const exomesh = rollupExomeshCsv(MINI_CSV, "/tmp/exomesh.csv");
    const sepsb = rollupSepsbCsv("");
    const rollup = buildRollupJson(exomesh, sepsb, onchain ?? undefined);
    expect(onchain).not.toBeNull();
    expect(onchain!.total_rows).toBe(1);
    expect(onchain!.rows[0]!.tx_hash).toBe("0xdeadbeef");
    expect(onchain!.rows[0]!.gas_burned).toBeGreaterThan(0);
    expect(rollup.exomesh.total_rows).toBe(3);
    expect(rollup.exomesh.simulated_loss_prevented_usd_total).toBe(46855);
    expect(rollup.onchain?.total_rows).toBe(1);
  });

  it("rolls up sanctuary onchain CSV with gates.sanctuary_mainnet", () => {
    const sanctuaryRow = mapOnchainLogToDuneRow(
      {
        chainId: 42161,
        network: "mainnet",
        blockNumber: 200n,
        transactionHash: "0xsanctuary",
        logIndex: 3,
        timestampMs: Date.parse("2026-09-20T01:00:00.000Z"),
        gasUsed: 60_000n,
        gasPriceWei: 1_500_000_000n,
        eventName: "RiskTripBlocked",
        intentHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
        agent: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        reason: "Q1_SANCTUARY_TELEMETRY_TRIP",
      },
      { vmExecution: "sanctuary", sourceLane: "mainnet:sanctuary" },
    );
    const onchain = rollupOnchainCsv(formatOnchainDuneCsv([sanctuaryRow]));
    expect(onchain).not.toBeNull();
    expect(onchain!.gates.sanctuary_mainnet).toMatch(/^0xb174/i);
    expect(onchain!.rows[0]!.vm_execution).toBe("sanctuary");
    expect(validateOnchainRows([sanctuaryRow])).toEqual([]);
  });

  it("allows onchain FAIL_CLOSED with gas_burned > 0", () => {
    const onchainRow = mapOnchainLogToDuneRow({
      chainId: 421614,
      network: "sepolia",
      blockNumber: 100n,
      transactionHash: "0xbeef",
      logIndex: 0,
      timestampMs: Date.parse("2026-09-14T00:00:00.000Z"),
      gasUsed: 80_000n,
      gasPriceWei: 2_000_000_000n,
      eventName: "RiskTripBlocked",
      intentHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      agent: "0xffffffffffffffffffffffffffffffffffffffff",
      reason: "SOIL_RESISTANCE_TRIP",
    });
    expect(validateOnchainRows([onchainRow])).toEqual([]);
    expect(onchainRow.gas_burned).toBeGreaterThan(0);
  });
});
