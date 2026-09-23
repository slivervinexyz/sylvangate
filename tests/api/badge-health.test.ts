import { afterEach, describe, expect, it } from "vitest";
import {
  buildFailClosedBadgeSvg,
  handleBadgeHealthRequest,
} from "../../src/api/routes/badge";
import {
  __setSystemStateForTests,
  buildBlockedSystemState,
  buildSystemState,
} from "../../src/core/state";

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("GET /api/badge/health", () => {
  it("returns fixed 220×20 SVG with fail-closed ACTIVE label", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ currentCri: 88, skipHardlockAssert: true }),
      hardlock: false,
      signingChannelOpen: true,
    });

    const res = handleBadgeHealthRequest();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");

    const svg = await res.text();
    expect(svg).toContain('width="220" height="20"');
    expect(svg).toContain('fill="#0d1117"');
    expect(svg).toContain('fill="#00ff88"');
    expect(svg).toContain("font-family=\"monospace\"");
    expect(svg).toContain("500ms Fail-Closed: ACTIVE");
  });

  it("returns TRIPPED badge when hardlock is active", async () => {
    __setSystemStateForTests(buildBlockedSystemState());

    const res = handleBadgeHealthRequest();
    const svg = await res.text();
    expect(svg).toContain("500ms Fail-Closed: TRIPPED");
    expect(svg).toContain('fill="#ff4444"');
  });

  it("buildFailClosedBadgeSvg matches grant DX spec dimensions", () => {
    const svg = buildFailClosedBadgeSvg(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="220" height="20"');
  });
});
