import { describe, expect, it } from "vitest";
import {
  GATE_ACTION_FAIL_CLOSED_BLOCK,
  GATE_ACTION_PASS_GREENLIGHT,
} from "../../src/core/gate-telemetry-types";
import {
  DEFAULT_SEPOLIA_LOOKBACK_BLOCKS,
  formatOnchainDuneCsv,
  mapOnchainLogToDuneRow,
  parseOnchainDuneCsv,
  resolveSanctuaryGate,
  resolveGateForNetwork,
  type ParsedOnchainGateLog,
} from "../../scripts/_shared/onchain-dune-telemetry";

function sampleLog(overrides: Partial<ParsedOnchainGateLog> = {}): ParsedOnchainGateLog {
  return {
    chainId: 42161,
    network: "mainnet",
    blockNumber: 501_230_000n,
    transactionHash: "0xabc123",
    logIndex: 1,
    timestampMs: Date.parse("2026-09-10T12:00:00.000Z"),
    gasUsed: 120_000n,
    gasPriceWei: 100_000_000n,
    eventName: "IntentAttested",
    intentHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    agent: "0xdddddddddddddddddddddddddddddddddddddddd",
    action: GATE_ACTION_FAIL_CLOSED_BLOCK,
    shadowMarginUsd: 42_100_000_000n,
    ...overrides,
  };
}

describe("onchain-dune-telemetry", () => {
  it("maps IntentAttested shadow margin into simulated_loss_prevented_usd", () => {
    const row = mapOnchainLogToDuneRow(sampleLog());
    expect(row.status).toBe("FAIL_CLOSED");
    expect(row.simulated_loss_prevented_usd).toBe(42100);
    expect(row.venue).toBe("pendle");
    expect(row.block_number).toBe("501230000");
    expect(row.tx_hash).toBe("0xabc123");
    expect(row.source).toMatch(/^onchain:mainnet:IntentAttested:/);
    expect(row.vm_execution).toBe("solidity");
  });

  it("maps RiskTripBlocked to soil resistance trip telemetry", () => {
    const row = mapOnchainLogToDuneRow(
      sampleLog({
        eventName: "RiskTripBlocked",
        reason: "HL_SPREAD_JITTER",
        action: undefined,
        shadowMarginUsd: undefined,
      }),
    );
    expect(row.intercept_type).toBe("SOIL_RESISTANCE_TRIP");
    expect(row.status).toBe("FAIL_CLOSED");
    expect(row.venue).toBe("hyperliquid");
  });

  it("formats on-chain CSV with extended block/tx/source columns", () => {
    const allow = mapOnchainLogToDuneRow(sampleLog({ action: GATE_ACTION_PASS_GREENLIGHT }));
    const csv = formatOnchainDuneCsv([allow]);
    expect(csv.startsWith("timestamp,venue,intercept_type,reflex_latency_us,gas_burned,simulated_loss_prevented_usd,gas_saved_usd,status")).toBe(true);
    expect(csv.startsWith("#")).toBe(false);
    expect(csv).toContain("block_number,tx_hash,log_index,chain_id,network,vm_execution,event_name,source");
    expect(csv).toContain("ALLOW");
    expect(csv).toContain("0xabc123");
    const roundTrip = parseOnchainDuneCsv(csv);
    expect(roundTrip).toHaveLength(1);
    expect(roundTrip[0]!.tx_hash).toBe("0xabc123");
    expect(roundTrip[0]!.block_number).toBe("501230000");
    expect(roundTrip[0]!.source).toMatch(/^onchain:/);
    expect(roundTrip[0]!.vm_execution).toBe("solidity");
  });

  it("uses 2.5M block Sepolia lookback", () => {
    expect(DEFAULT_SEPOLIA_LOOKBACK_BLOCKS).toBe(2_500_000n);
  });

  it("resolves per-network gate addresses", () => {
    expect(resolveGateForNetwork("mainnet")).toMatch(/^0x71D7/i);
    expect(resolveGateForNetwork("sepolia")).toMatch(/^0xc66F/i);
  });

  it("maps Sanctuary gate logs with vm_execution=sanctuary", () => {
    const row = mapOnchainLogToDuneRow(
      sampleLog({
        eventName: "RiskTripBlocked",
        reason: "Q1_SANCTUARY_TELEMETRY_TRIP",
        action: undefined,
        shadowMarginUsd: undefined,
      }),
      { vmExecution: "sanctuary", sourceLane: "mainnet:sanctuary" },
    );
    expect(row.vm_execution).toBe("sanctuary");
    expect(row.source).toMatch(/^onchain:mainnet:sanctuary:RiskTripBlocked:/);
  });

  it("resolves Sanctuary gate to legacy dual-deploy address", () => {
    expect(resolveSanctuaryGate()).toMatch(/^0xb174/i);
  });
});
