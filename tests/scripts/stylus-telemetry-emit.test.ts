import { describe, expect, it } from "vitest";
import { mapStylusTxToDuneRow } from "../../scripts/_shared/onchain-stylus-rows";
import { formatOnchainDuneCsv, parseOnchainDuneCsv } from "../../scripts/_shared/onchain-dune-telemetry";

describe("stylus-telemetry-emit", () => {
  it("maps Stylus tx to Dune row with vm_execution=stylus", () => {
    const row = mapStylusTxToDuneRow({
      txHash: "0xstylus123",
      contract: "0xc23587d6573dd134f95b02b0202ffbf84686625e",
      chainId: 42161,
      blockNumber: 506_936_000n,
      timestampMs: Date.parse("2026-09-20T01:00:00.000Z"),
      gasUsed: 90_000n,
      gasPriceWei: 1_000_000_000n,
      passed: false,
    });
    expect(row.vm_execution).toBe("stylus");
    expect(row.event_name).toBe("SoilCoprocessorEval");
    expect(row.network).toBe("mainnet");
    expect(row.status).toBe("FAIL_CLOSED");
    expect(row.source).toContain(":stylus:SoilCoprocessorEval:");
  });

  it("round-trips mixed vm_execution CSV", () => {
    const stylus = mapStylusTxToDuneRow({
      txHash: "0xstylus456",
      contract: "0xc23587d6573dd134f95b02b0202ffbf84686625e",
      chainId: 42161,
      blockNumber: 100n,
      timestampMs: Date.parse("2026-09-20T02:00:00.000Z"),
      gasUsed: 1_000n,
      gasPriceWei: 1n,
      passed: false,
    });
    const csv = formatOnchainDuneCsv([stylus]);
    const rows = parseOnchainDuneCsv(csv);
    expect(rows[0]!.vm_execution).toBe("stylus");
    expect(rows[0]!.event_name).toBe("SoilCoprocessorEval");
  });
});
