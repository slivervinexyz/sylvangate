import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CORE_GATEWAY_FILES,
  CORE_ORCHESTRATION_SINK_ALLOWLIST,
  scanCoreSourceImports,
} from "../../src/core/core-import-boundary";

const ROOT = join(import.meta.dirname, "../..");
const CORE_DIR = join(ROOT, "src/core");

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsFiles(p, acc);
    else if (name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

describe("core import boundary — layer inversion scan", () => {
  it("gateway files (state/risk/agent-guard) have zero services imports", () => {
    const violations: string[] = [];
    for (const rel of CORE_GATEWAY_FILES) {
      const abs = join(ROOT, rel);
      const src = readFileSync(abs, "utf8");
      for (const hit of scanCoreSourceImports(src, rel)) {
        if (hit.includes("services/") || hit.includes("adapters/") || hit.includes("routes/")) {
          violations.push(hit);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("orchestration sinks are the only core files that may import services/", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(CORE_DIR)) {
      const rel = relative(ROOT, file);
      const src = readFileSync(file, "utf8");
      const importRe = /from\s+["']([^"']+)["']/g;
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(src)) !== null) {
        const spec = m[1]!;
        if (!spec.includes("services/")) continue;
        const norm = rel.replace(/\\/g, "/");
        if (!CORE_ORCHESTRATION_SINK_ALLOWLIST.includes(norm)) {
          violations.push(`${norm} -> ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("scans all src/core for forbidden cross-layer imports", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(CORE_DIR)) {
      const rel = relative(ROOT, file);
      violations.push(...scanCoreSourceImports(readFileSync(file, "utf8"), rel));
    }
    expect(violations).toEqual([]);
  });
});
