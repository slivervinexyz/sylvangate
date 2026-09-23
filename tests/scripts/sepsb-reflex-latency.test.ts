import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HL_WASM_REFLEX_MAX_US,
  HL_WASM_REFLEX_MIN_US,
  VENUE_REFLEX_CAP_US,
  measureSepsbReflexLatencyUs,
} from "../../scripts/sepsb-reflex-latency";
import type { SepsbCorpusCase, SepsbCorpusFile } from "../../scripts/sepsb-benchmark-types";

const toxicPath = join(process.cwd(), "tests/p0/corpus/toxic-set.json");
const benignPath = join(process.cwd(), "tests/p0/corpus/benign-set.json");

function loadCases(): SepsbCorpusCase[] {
  const toxic = JSON.parse(readFileSync(toxicPath, "utf8")) as SepsbCorpusFile;
  const benign = JSON.parse(readFileSync(benignPath, "utf8")) as SepsbCorpusFile;
  return [...toxic.cases, ...benign.cases];
}

describe("sepsb-reflex-latency", () => {
  const cases = loadCases();

  it("keeps hyperliquid wasm reflex inside the 15-45µs band", () => {
    for (const caseRow of cases.filter((row) => row.venue === "hyperliquid")) {
      const latencyUs = measureSepsbReflexLatencyUs(caseRow, "hyperliquid");
      expect(latencyUs).toBeGreaterThanOrEqual(HL_WASM_REFLEX_MIN_US);
      expect(latencyUs).toBeLessThanOrEqual(HL_WASM_REFLEX_MAX_US);
    }
  });

  it("keeps all venue reflex latencies under 100µs", () => {
    for (const caseRow of cases) {
      const latencyUs = measureSepsbReflexLatencyUs(caseRow, caseRow.venue);
      expect(latencyUs).toBeGreaterThan(0);
      expect(latencyUs).toBeLessThan(VENUE_REFLEX_CAP_US);
    }
  });
});
