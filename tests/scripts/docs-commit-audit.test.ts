import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  VERIFIED_COMMIT_MARKER_PATHS,
  loadSystemMetricsSsot,
  resolveReleaseAnchor,
} from "../../scripts/_shared/sync-ssot-docs-lib";

const ROOT = process.cwd();

function readMarkerBody(rel: string, marker: string): string {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const start = `<!-- SSOT:${marker}_START -->`;
  const end = `<!-- SSOT:${marker}_END -->`;
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  expect(i).toBeGreaterThanOrEqual(0);
  expect(j).toBeGreaterThan(i);
  return text.slice(i + start.length, j);
}

describe("docs-commit-audit fixtures", () => {
  const ssot = loadSystemMetricsSsot(ROOT);
  const anchor = resolveReleaseAnchor(ssot);

  it("all verified-commit marker paths exist on disk", () => {
    for (const rel of VERIFIED_COMMIT_MARKER_PATHS) {
      expect(() => readFileSync(join(ROOT, rel), "utf8")).not.toThrow();
    }
  });

  it("JUDGE_VERIFIED_COMMIT marker contains SSOT verified_commit", () => {
    const body = readMarkerBody("JUDGE_BRIEF.md", "JUDGE_VERIFIED_COMMIT");
    expect(body).toContain(anchor.verified_commit);
    expect(body).not.toContain("e489d34");
  });

  it("SUBMISSION_VERIFIED_COMMIT marker contains SSOT verified_commit", () => {
    const body = readMarkerBody("docs/00_ARB_Buildathon/SUBMISSION.md", "SUBMISSION_VERIFIED_COMMIT");
    expect(body).toContain(anchor.verified_commit);
  });

  it("VERIFICATION_VERIFIED_COMMIT marker contains SSOT verified_commit", () => {
    const body = readMarkerBody("docs/03_product_verifications/01_VERIFICATION_MATRIX.md", "VERIFICATION_VERIFIED_COMMIT");
    expect(body).toContain(anchor.verified_commit);
  });

  it("PRODUCTION verified markers contain SSOT verified_commit", () => {
    const header = readMarkerBody("docs/PRODUCTION_WORKFLOW_DEEP_DIVE.md", "PRODUCTION_VERIFIED_COMMIT");
    const footer = readMarkerBody("docs/PRODUCTION_WORKFLOW_DEEP_DIVE.md", "PRODUCTION_VERIFIED_FOOTER");
    expect(header).toContain(anchor.verified_commit);
    expect(footer).toContain(anchor.verified_commit);
  });

  it("ONCHAIN_VERIFIED_COMMIT marker contains SSOT verified_commit", () => {
    const body = readMarkerBody(
      "docs/03_product_verifications/shared_proofs/01_ON_CHAIN_MAINNET_ANCHORS.md",
      "ONCHAIN_VERIFIED_COMMIT",
    );
    expect(body).toContain(anchor.verified_commit);
  });
});
