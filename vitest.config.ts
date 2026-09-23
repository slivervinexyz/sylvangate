import { defineConfig } from "vitest/config";

const ASYNC_API_TEST_GLOBS = [
  "tests/api/**/*.test.ts",
  "tests/adapters/gmx-v2-gm-balance-swr.test.ts",
  "tests/components/grant-audit-fetch.test.ts",
  "tests/middleware/engine-mode-router.test.ts",
  "tests/worker-fetch.test.ts",
];

const UNIT_TEST_GLOBS = [
  "tests/**/*.test.ts",
  "src/**/*.test.ts",
  "src/**/*.spec.ts",
];

const coverage = {
  provider: "v8" as const,
  include: ["src/services/risk-control.ts"],
  exclude: ["**/*.d.ts"],
  reportsDirectory: "./coverage",
  reporter: ["text", "json-summary"] as const,
  thresholds: {
    lines: 90,
    functions: 100,
    branches: 70,
    statements: 90,
  },
};

const shared = {
  environment: "node" as const,
  setupFiles: ["./vitest.setup.ts"],
};

export default defineConfig({
  test: {
    dir: ".",
    pool: "forks",
    fileParallelism: true,
    maxWorkers: "50%",
    poolOptions: {
      forks: {
        execArgv: ["--expose-gc"],
      },
    },
    coverage,
    projects: [
      {
        test: {
          ...shared,
          name: "unit",
          include: UNIT_TEST_GLOBS,
          exclude: ASYNC_API_TEST_GLOBS,
          testTimeout: 5_000,
          hookTimeout: 5_000,
        },
      },
      {
        test: {
          ...shared,
          name: "async-api",
          include: ASYNC_API_TEST_GLOBS,
          testTimeout: 10_000,
          hookTimeout: 10_000,
        },
      },
    ],
  },
});
