import { describe, expect, it } from "vitest";
import {
  buildProofsBadgeSvg,
  handleBadgeProofsRequest,
} from "../../src/api/routes/badge";

describe("GET /api/badge/proofs", () => {
  it("returns fixed 260×20 SVG with verified fail-closed proof label", async () => {
    const res = handleBadgeProofsRequest();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");

    const svg = await res.text();
    expect(svg).toContain('width="260" height="20"');
    expect(svg).toContain('fill="#0d1117"');
    expect(svg).toContain('fill="#00ff88"');
    expect(svg).toContain('font-family="monospace"');
    expect(svg).toContain("5/5 FAIL-CLOSED PROOFS: VERIFIED");
    expect(svg).toContain("SliverVine");
    expect(svg).toContain('stroke="#00ff88"');
  });

  it("buildProofsBadgeSvg includes SliverVine shield mark iconography", () => {
    const svg = buildProofsBadgeSvg(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('opacity="0.28"');
    expect(svg).toContain("[ 🛡️ SliverVine | 5/5 FAIL-CLOSED PROOFS: VERIFIED ]");
  });

  it("buildProofsBadgeSvg shows pending state when unverified", () => {
    const svg = buildProofsBadgeSvg(false);
    expect(svg).toContain('fill="#ff4444"');
    expect(svg).toContain("FAIL-CLOSED PROOFS: PENDING");
  });
});
