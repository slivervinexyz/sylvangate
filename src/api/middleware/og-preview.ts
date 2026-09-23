import { CORS_JSON_HEADERS } from "../../services/config";
import { renderGtagHeadSnippet } from "../../lib/gtag-analytics";

export const GRANT_AUDIT_VERSION_HEADER = "X-Slivervine-Version";
export const GRANT_AUDIT_DEFENSE_HEADER = "X-Defense-Matrix";

export const GRANT_AUDIT_VERSION = "v1.0-santenmoku";
export const GRANT_AUDIT_DEFENSE_MATRIX = "20-Roots-Active";

export const PUBLIC_AUDIT_ENDPOINTS = [
  "/api/telemetry/health",
  "/api/state",
  "/api/data",
  "/api/hedge/evaluate",
] as const;

export type PublicAuditEndpoint = (typeof PUBLIC_AUDIT_ENDPOINTS)[number];

export interface OgPreviewMetadata {
  title: string;
  description: string;
  url: string;
  type: "website";
  siteName: string;
  image: string;
}

export interface OgPreviewInput {
  pathname: string;
  origin?: string;
  criIndex?: number;
  hudState?: string;
}

/** Deploy SSOT — see docs/01_architecture_and_standards/01_core_specs/03_CONTRACT_DEPLOYMENT_MATRIX.md */
const DEFAULT_ORIGIN = "https://bedeltawater.slivervine.xyz";
const DEFAULT_OG_IMAGE = `${DEFAULT_ORIGIN}/og/grant-audit-card.png`;

const ENDPOINT_COPY: Record<
  PublicAuditEndpoint,
  { title: string; description: string }
> = {
  "/api/telemetry/health": {
    title: "BeΔ Living Water — Live Telemetry",
    description:
      "Public CRI index, soil resistance status, active venues, and circuit breaker health.",
  },
  "/api/state": {
    title: "BeΔ Living Water — System State",
    description:
      "Authoritative Risk Envelope system snapshot for grant auditor verification.",
  },
  "/api/data": {
    title: "BeΔ Living Water — Matrix Data",
    description:
      "Cross-venue arbitrage matrix feed with risk tripped flags for auditor review.",
  },
  "/api/hedge/evaluate": {
    title: "BeΔ Living Water — Tail Hedge Evaluation",
    description:
      "Polymarket tail-hedge trigger evaluation gated by unified Risk Envelope policy.",
  },
};

export function isPublicAuditEndpoint(pathname: string): pathname is PublicAuditEndpoint {
  return (PUBLIC_AUDIT_ENDPOINTS as readonly string[]).includes(pathname);
}

/** Structured Open Graph metadata for public audit endpoints. */
export function generateOgPreviewMetadata(input: OgPreviewInput): OgPreviewMetadata {
  const origin = input.origin ?? DEFAULT_ORIGIN;
  const pathname = isPublicAuditEndpoint(input.pathname)
    ? input.pathname
    : "/api/telemetry/health";
  const copy = ENDPOINT_COPY[pathname];
  const criSuffix =
    input.criIndex !== undefined ? ` · CRI ${input.criIndex}` : "";
  const hudSuffix = input.hudState ? ` · HUD ${input.hudState}` : "";

  return {
    title: copy.title,
    description: `${copy.description}${criSuffix}${hudSuffix}`,
    url: `${origin}${pathname}`,
    type: "website",
    siteName: "SliverVine Protocol",
    image: DEFAULT_OG_IMAGE,
  };
}

/** Render HTML meta tags for social card crawlers. */
export function renderOgMetaTags(meta: OgPreviewMetadata): string {
  return [
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:site_name" content="${escapeHtml(meta.siteName)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
  ].join("\n");
}

/** Minimal HTML document for OG preview / social card rendering. */
export function buildOgPreviewDocument(meta: OgPreviewMetadata): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(meta.title)}</title>
  ${renderGtagHeadSnippet()}
  ${renderOgMetaTags(meta)}
</head>
<body>
  <h1>${escapeHtml(meta.title)}</h1>
  <p>${escapeHtml(meta.description)}</p>
</body>
</html>`;
}

export function grantAuditHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    ...extra,
    [GRANT_AUDIT_VERSION_HEADER]: GRANT_AUDIT_VERSION,
    [GRANT_AUDIT_DEFENSE_HEADER]: GRANT_AUDIT_DEFENSE_MATRIX,
  };
}

/** Merge CORS JSON headers with Grant Audit headers for public API responses. */
export function publicApiHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return grantAuditHeaders({ ...CORS_JSON_HEADERS, ...extra });
}

/** Inject Grant Audit headers onto an existing Response. */
export function applyGrantAuditHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(GRANT_AUDIT_VERSION_HEADER, GRANT_AUDIT_VERSION);
  headers.set(GRANT_AUDIT_DEFENSE_HEADER, GRANT_AUDIT_DEFENSE_MATRIX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** GET /api/og-preview — HTML social card for a public audit endpoint. */
export function handleOgPreviewRequest(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== "/api/og-preview" || request.method !== "GET") {
    return null;
  }

  const targetPath = url.searchParams.get("path") ?? "/api/telemetry/health";
  const criRaw = url.searchParams.get("cri");
  const criIndex = criRaw !== null ? Number(criRaw) : undefined;
  const hudState = url.searchParams.get("hud") ?? undefined;

  const meta = generateOgPreviewMetadata({
    pathname: targetPath,
    origin: url.origin,
    criIndex: Number.isFinite(criIndex) ? criIndex : undefined,
    hudState: hudState ?? undefined,
  });

  return new Response(buildOgPreviewDocument(meta), {
    status: 200,
    headers: publicApiHeaders({ "Content-Type": "text/html; charset=utf-8" }),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
