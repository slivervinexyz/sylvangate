import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FREEZE = JSON.parse(
  readFileSync(join(process.cwd(), "docs/audit/CODEBASE_FREEZE.json"), "utf8"),
);
const SSOT = JSON.parse(
  readFileSync(join(process.cwd(), "docs/audit/SYSTEM_METRICS_SSOT.json"), "utf8"),
);

describe("codebase freeze — Phase-4 SSOT lock", () => {
  it("freeze manifest is active at phase 4", () => {
    expect(FREEZE.phase).toBe(4);
    expect(FREEZE.active).toBe(true);
    expect(FREEZE.benchmark_lock.alloc).toBe("<16 KiB");
    expect(FREEZE.benchmark_lock.iterations).toBe(10_000);
  });

  it("SYSTEM_METRICS_SSOT matches freeze benchmark lock", () => {
    expect(SSOT.badges.hot_path.alloc).toBe(FREEZE.benchmark_lock.alloc);
    expect(SSOT.badges.hot_path.iterations).toBe("10k");
    expect(SSOT.badges.codebase_freeze?.active).toBe(true);
  });
});
