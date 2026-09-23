import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  applyBundleGlobalSync,
  applyVerifiedCommitGlobalSync,
  applyVitestGlobalSync,
  buildDualTelemetryBlock,
  buildReadmeBadges,
  buildSepsbTable,
  buildVerifiedCommitLine,
  loadSystemMetricsSsot,
  repairNestedWholeLineBold,
  repairVitestBoldCorruption,
  replaceMarkedBlock,
  shieldsEncode,
  shieldsStaticBadge,
  syncMarkdownFile,
  transformMarkdownContent,
} from "../../scripts/_shared/sync-ssot-docs-lib";

const ROOT = process.cwd();

describe("sync-ssot-docs", () => {
  const ssot = loadSystemMetricsSsot(ROOT);

  it("loads SYSTEM_METRICS_SSOT.json", () => {
    expect(ssot.badges.vitest.test_files_passed).toBe(254);
    expect(ssot.badges.vitest.total_tests_passed).toBe(1206);
    expect(ssot.bundle_telemetry.gzipKiB).toBe(40.5);
    expect(ssot.sepsb_benchmark.truePositiveRatePct).toBe(100);
  });

  it("replaces marked blocks without dropping markers", () => {
    const source = "<!-- SSOT:README_BADGES_START -->\nold\n<!-- SSOT:README_BADGES_END -->";
    const next = replaceMarkedBlock(source, "README_BADGES", "new-badge");
    expect(next).toContain("<!-- SSOT:README_BADGES_START -->");
    expect(next).toContain("new-badge");
  });

  it("builds README badges from vitest SSOT counts", () => {
    const badges = buildReadmeBadges(ssot);
    expect(badges).toContain(String(ssot.badges.vitest.total_tests_passed));
    expect(badges).toContain(String(ssot.badges.vitest.test_files_passed));
  });

  it("applies Shields.io double-dash escaping and percent-encodes markdown-breaking chars", () => {
    expect(shieldsEncode("Zero-Alloc Hot-Path")).toBe("Zero--Alloc_Hot--Path");
    expect(shieldsEncode("<16 KiB / 10k iterations")).toBe("%3C16_KiB_%2F_10k_iterations");
    const url = shieldsStaticBadge("V2.0 Stylus Probe", "9/9 PASS (Roadmap)", "blue", "rust");
    expect(url).toContain("9%2F9_PASS_%28Roadmap%29");
    expect(url).not.toContain("(Roadmap)");
    expect(shieldsStaticBadge("Zero-Alloc Hot-Path", "<16 KiB / 10k iterations", "blue")).toBe(
      "https://img.shields.io/badge/Zero--Alloc_Hot--Path-%3C16_KiB_%2F_10k_iterations-blue",
    );
  });

  it("buildDualTelemetryBlock uses demoted simulation phrasing", () => {
    const block = buildDualTelemetryBlock(ssot);
    expect(block).toMatch(/Modeled Simulation Telemetry \(Backtested Chaos Matrix Replay\)/);
    expect(block).toMatch(/NOT a Mainnet Live Feed/);
    expect(block).toMatch(/Live On-Chain Gate Attestations/);
    expect(block).toMatch(/577-row/);
    expect(block).toMatch(/\$13\.49M/);
    expect(block).toMatch(/\$136\.25/);
    expect(block).not.toMatch(/313-row/);
    expect(block).not.toMatch(/live event lane/i);
    expect(block).not.toMatch(/Dynamic operational feed/i);
    expect(block).not.toMatch(/live ingestion post-grant/i);
  });

  it("builds SEPSB table with reflex p50/p99 from SSOT", () => {
    const table = buildSepsbTable(ssot);
    expect(table).toContain(`${ssot.sepsb_benchmark.reflexLatencyP50Us}µs`);
    expect(table).toContain(`${ssot.sepsb_benchmark.reflexLatencyP99Us}µs`);
  });

  it("README contains SSOT marker blocks for sync", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    expect(readme).toContain("<!-- SSOT:README_BADGES_START -->");
    expect(readme).toContain("<!-- SSOT:README_SEPSB_TABLE_END -->");
  });

  it("applyVitestGlobalSync scrubs legacy 235/1091/1120 drift", () => {
    const stale =
      "**235 test files | 1091 PASS clean** · headline **1091 PASS** · (**235 test files / 1091 PASS / 3,320+**) · # 235 test files | 1120 PASS clean";
    const synced = applyVitestGlobalSync(stale, ssot.badges.vitest.test_files_passed, ssot.badges.vitest.total_tests_passed);
    expect(synced).not.toMatch(/\b(235|1091|1120)\b/);
    expect(synced).toContain(`${ssot.badges.vitest.test_files_passed} test files`);
    expect(synced).toContain(`${ssot.badges.vitest.total_tests_passed} PASS`);
  });

  it("applyVitestGlobalSync is idempotent on already-bold Vitest SSOT strings", () => {
    const bold = `**${ssot.badges.vitest.test_files_passed} test files | ${ssot.badges.vitest.total_tests_passed} PASS clean (100%)**`;
    const once = applyVitestGlobalSync(bold, ssot.badges.vitest.test_files_passed, ssot.badges.vitest.total_tests_passed);
    const twice = applyVitestGlobalSync(once, ssot.badges.vitest.test_files_passed, ssot.badges.vitest.total_tests_passed);
    expect(once).toBe(bold);
    expect(twice).toBe(bold);
    expect(once).not.toMatch(/\|\*\*/);
  });

  it("repairVitestBoldCorruption fixes double-replace markdown bold", () => {
    const broken = "**251 test files |**251 test files \\| 1176 PASS clean**|**251 test files \\| 1176 PASS clean**";
    const fixed = repairVitestBoldCorruption(broken, 251, 1176);
    expect(fixed).toBe("**251 test files | 1176 PASS clean (100%)**");
  });

  it("repairNestedWholeLineBold unwraps nested emphasis in verdict lines", () => {
    const broken = "**裁決：Combined **9.53 / 10.0**（Δ +0.01）。**";
    const fixed = repairNestedWholeLineBold(broken);
    expect(fixed).toBe("**裁決：Combined 9.53 / 10.0（Δ +0.01）。**");
  });

  it("applyBundleGlobalSync scrubs legacy bundle drift", () => {
    const stale = "**58.72 KiB gzip** · 166.51 KiB raw · 166.51 KiB raw / 58.72 KiB gzip";
    const synced = applyBundleGlobalSync(stale, ssot.bundle_telemetry.rawKiB, ssot.bundle_telemetry.gzipKiB);
    expect(synced).not.toMatch(/166\.51|58\.72/);
    expect(synced).toContain(`${ssot.bundle_telemetry.gzipKiB} KiB gzip`);
    expect(synced).toContain(`${ssot.bundle_telemetry.rawKiB} KiB raw`);
  });

  it("transformMarkdownContent syncs vitest headline without markers", () => {
    const stale = "**238 test files | 1108 PASS clean** · **58.72 KiB gzip**";
    const synced = transformMarkdownContent(
      "docs/README.md",
      stale,
      ssot,
    );
    expect(synced).toContain(`${ssot.badges.vitest.test_files_passed} test files | ${ssot.badges.vitest.total_tests_passed} PASS clean`);
    expect(synced).toContain(`${ssot.bundle_telemetry.gzipKiB} KiB gzip`);
  });

  it("loads release_anchor from SYSTEM_METRICS_SSOT.json", () => {
    expect(ssot.release_anchor?.verified_commit).toMatch(/^[0-9a-f]{7}$/);
    expect(ssot.release_anchor?.baseline_commit).toBe("572e5cd");
  });

  it("buildVerifiedCommitLine uses SSOT release_anchor", () => {
    const line = buildVerifiedCommitLine(ssot);
    expect(line).toContain(ssot.release_anchor!.verified_commit);
    expect(line).toContain("572e5cd");
    expect(line).toMatch(/Verified Commit/);
  });

  it("replaceMarkedBlock preserves JUDGE_VERIFIED_COMMIT markers", () => {
    const source =
      "<!-- SSOT:JUDGE_VERIFIED_COMMIT_START -->\nold\n<!-- SSOT:JUDGE_VERIFIED_COMMIT_END -->";
    const next = replaceMarkedBlock(source, "JUDGE_VERIFIED_COMMIT", buildVerifiedCommitLine(ssot));
    expect(next).toContain("<!-- SSOT:JUDGE_VERIFIED_COMMIT_START -->");
    expect(next).toContain(ssot.release_anchor!.verified_commit);
  });

  it("applyVerifiedCommitGlobalSync replaces stale e489d34 verified hash", () => {
    const stale = "> **Verified Commit:** `main` @ **`e489d34`** · baseline **`572e5cd`**";
    const synced = applyVerifiedCommitGlobalSync(stale, ssot);
    expect(synced).toContain(ssot.release_anchor!.verified_commit);
    expect(synced).not.toContain("e489d34");
  });

  it("transformMarkdownContent syncs VERIFICATION_VERIFIED_COMMIT marker", () => {
    const source =
      "<!-- SSOT:VERIFICATION_VERIFIED_COMMIT_START -->\nold\n<!-- SSOT:VERIFICATION_VERIFIED_COMMIT_END -->";
    const synced = transformMarkdownContent("docs/03_product_verifications/01_VERIFICATION_MATRIX.md", source, ssot);
    expect(synced).toContain(ssot.release_anchor!.verified_commit);
    expect(synced).not.toContain("\nold\n");
  });

  it("JUDGE_BRIEF and README have no stale vitest counts after sync", () => {
    syncMarkdownFile(ROOT, "JUDGE_BRIEF.md", ssot);
    syncMarkdownFile(ROOT, "README.md", ssot);
    const judge = readFileSync(join(ROOT, "JUDGE_BRIEF.md"), "utf8");
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    const expectSsot = `${ssot.badges.vitest.test_files_passed} test files | ${ssot.badges.vitest.total_tests_passed} PASS`;
    expect(judge).toContain(expectSsot);
    expect(readme).toContain(expectSsot);
    expect(judge).not.toMatch(/\b(1091|1108|1120) PASS\b/);
    expect(judge).not.toMatch(/\b235 test files\b/);
    expect(readme).not.toMatch(/\b(1091|1108|1120) PASS\b/);
    expect(judge).not.toMatch(/166\.51 KiB raw|58\.72 KiB gzip/);
  });
});
