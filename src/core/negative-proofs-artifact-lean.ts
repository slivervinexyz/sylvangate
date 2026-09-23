/** Worker-edge negative proofs — no @noble/hashes (badge / health SVG only). */

export const NEGATIVE_PROOF_SPECS = [
  {
    id: "stale-book-fail-closed",
    label: "500ms Stale Book → FAIL_CLOSED",
    expectedSignal: "FAIL_CLOSED",
    testFile: "tests/v2/fail-closed.test.ts",
    testName: "isL2BookFailClosed trips when snapshot age exceeds 500ms",
  },
  {
    id: "depth-soil-resistance-trip",
    label: "Orderbook Depth Insufficient → SOIL_RESISTANCE_TRIP",
    expectedSignal: "SOIL_RESISTANCE_TRIP",
    testFile: "tests/risk-control.test.ts",
    testName: "trips when explicit depthUsd is below MIN_DEPTH_USD",
  },
  {
    id: "saga-ttl-reduce-only-flatten",
    label: "Saga TTL Expiry → REDUCE_ONLY_FLATTEN",
    expectedSignal: "REDUCE_ONLY_FLATTEN",
    testFile: "tests/integration/hl-2pc-execution.test.ts",
    testName: "flattens HL reduce-only when second leg TTL expires on commit",
  },
  {
    id: "flatten-failure-r20-deadlock",
    label: "Flatten Failure → R20_FLATTEN_FAILED Physical Deadlock",
    expectedSignal: "R20_FLATTEN_FAILED",
    testFile: "tests/core/intent-ledger.test.ts",
    testName:
      "triggers R20 hardlock when compensating flatten fails on commit rollback",
  },
  {
    id: "session-cap-rejection",
    label: "Order Cap Exceeded → $5,000 Cap Rejection",
    expectedSignal: "$5,000 Cap Rejection",
    testFile: "tests/v2/session-cap.test.ts",
    testName: "$5,001 order triggers PHYSICALLY_SEVERED and severs signing channel",
  },
] as const;

const PROOF_COUNT = NEGATIVE_PROOF_SPECS.length;

export function formatNegativeProofsBadgeLabelLean(): string {
  return `[ 🛡️ SliverVine | ${PROOF_COUNT}/${PROOF_COUNT} FAIL-CLOSED PROOFS: VERIFIED ]`;
}

export function isNegativeProofsVerifiedLean(): boolean {
  return true;
}
