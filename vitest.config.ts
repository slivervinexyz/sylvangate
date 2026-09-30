import { defineConfig } from "vitest/config";

// Validation suite manifest: docs/_snippets/judge-bar-ssot.json (14 files · 55 tests)

const SYLVANGATE_UNIT_GLOBS = [
  "tests/adapters/across-ingress-bridge.test.ts",
  "tests/adapters/across-ingress-bridge-omni.test.ts",
  "tests/adapters/treasury-escort-router.test.ts",
  "tests/adapters/zerodev-aa-gate.test.ts",
  "tests/adapters/zerodev-aa-readiness.test.ts",
  "tests/adversarial/sylvangate-toxic-corpus.test.ts",
  "tests/core/agent-exomesh-guard.test.ts",
  "tests/core/intent-mandate-adversarial.test.ts",
  "tests/core/signing-channel-severance.test.ts",
  "tests/core/airlock-threshold.test.ts",
  "tests/core/venue-drift-mandate.test.ts",
  "tests/security/sdk-export-surface.test.ts",
  "tests/sdk/robinhood-audit-snapshot.test.ts",
  "tests/scripts/rchain-escort-attestation.test.ts",
];

export default defineConfig({
  test: {
    dir: ".",
    pool: "forks",
    setupFiles: ["./vitest.setup.ts"],
    include: SYLVANGATE_UNIT_GLOBS,
    testTimeout: 5_000,
    hookTimeout: 5_000,
  },
});
