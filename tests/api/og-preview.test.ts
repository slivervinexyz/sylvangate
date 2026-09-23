import { afterEach, describe, expect, it } from "vitest";
import {
  GRANT_AUDIT_DEFENSE_HEADER,
  GRANT_AUDIT_DEFENSE_MATRIX,
  GRANT_AUDIT_VERSION,
  GRANT_AUDIT_VERSION_HEADER,
  applyGrantAuditHeaders,
  generateOgPreviewMetadata,
  handleOgPreviewRequest,
  renderOgMetaTags,
} from "../../src/api/middleware/og-preview";
import { handleTelemetryHealthRequest } from "../../src/api/routes/telemetry";
import {
  __setSystemStateForTests,
  buildSystemState,
} from "../../src/core/state";

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("generateOgPreviewMetadata", () => {
  it("builds structured OG metadata for telemetry audit endpoint", () => {
    const meta = generateOgPreviewMetadata({
      pathname: "/api/telemetry/health",
      origin: "https://bedeltawater.slivervine.xyz",
      criIndex: 95,
      hudState: "GREEN",
    });

    expect(meta.title).toContain("Telemetry");
    expect(meta.description).toContain("CRI 95");
    expect(meta.description).toContain("HUD GREEN");
    expect(meta.url).toBe("https://bedeltawater.slivervine.xyz/api/telemetry/health");
    expect(meta.type).toBe("website");
    expect(meta.siteName).toBe("SliverVine Protocol");
    expect(meta.image).toContain("/og/grant-audit-card.png");
  });
});

describe("renderOgMetaTags", () => {
  it("renders Open Graph and Twitter card meta tags", () => {
    const meta = generateOgPreviewMetadata({
      pathname: "/api/state",
      origin: "https://bedeltawater.slivervine.xyz",
    });
    const tags = renderOgMetaTags(meta);

    expect(tags).toContain('property="og:title"');
    expect(tags).toContain('property="og:description"');
    expect(tags).toContain('property="og:url"');
    expect(tags).toContain('name="twitter:card"');
    expect(tags).toContain("System State");
  });
});

describe("Grant Audit headers", () => {
  it("injects audit headers on public API responses", () => {
    __setSystemStateForTests({
      ...buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const res = applyGrantAuditHeaders(handleTelemetryHealthRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get(GRANT_AUDIT_VERSION_HEADER)).toBe(GRANT_AUDIT_VERSION);
    expect(res.headers.get(GRANT_AUDIT_DEFENSE_HEADER)).toBe(
      GRANT_AUDIT_DEFENSE_MATRIX,
    );
  });

  it("serves OG preview HTML with audit headers", async () => {
    const req = new Request(
      "https://bedeltawater.slivervine.xyz/api/og-preview?path=/api/telemetry/health&cri=88&hud=AMBER",
    );
    const res = handleOgPreviewRequest(req)!;

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get(GRANT_AUDIT_VERSION_HEADER)).toBe(GRANT_AUDIT_VERSION);
    expect(res.headers.get(GRANT_AUDIT_DEFENSE_HEADER)).toBe(
      GRANT_AUDIT_DEFENSE_MATRIX,
    );

    const html = await res.text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain("googletagmanager.com/gtag/js?id=G-HVW22VVK46");
    expect(html).toContain("CRI 88");
    expect(html).toContain("HUD AMBER");
  });
});
