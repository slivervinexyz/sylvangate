/**
 * Subprocess zero-alloc benchmark — sanctuary GMX packed eval (<16 KiB / 10k iter).
 */
import { packSanctuaryGmxWireEval } from "../../src/core/sanctuary-packed-pack";
import { evaluateSanctuaryPacked, ensureSanctuaryWasmRuntime } from "../../src/core/sanctuary-wasm-runtime";

const ITERATIONS = 10_000;
const HEAP_LIMIT_BYTES = 16 * 1024;
const PACKED = packSanctuaryGmxWireEval(
  { slippageBps: 100, expectedMarketTokens: 10_000_000n, poolLongUsd: 5_200_000, poolShortUsd: 4_800_000 },
  { executionFee: 10n ** 15n, minMarketTokens: 9_900_000n },
);

if (!ensureSanctuaryWasmRuntime()) {
  console.error("FAIL: sanctuary wasm not loaded");
  process.exit(1);
}

function runOnce(): number {
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < ITERATIONS; i += 1) evaluateSanctuaryPacked(PACKED);
  if (globalThis.gc) globalThis.gc();
  return process.memoryUsage().heapUsed - before;
}

let minDelta = Number.POSITIVE_INFINITY;
for (let attempt = 0; attempt < 3; attempt += 1) {
  minDelta = Math.min(minDelta, runOnce());
}

if (minDelta >= HEAP_LIMIT_BYTES) {
  console.error(`FAIL: heap delta ${minDelta} >= ${HEAP_LIMIT_BYTES}`);
  process.exit(1);
}
console.log(`PASS: sanctuary GMX eval ${ITERATIONS} iter heap delta ${minDelta} B`);
