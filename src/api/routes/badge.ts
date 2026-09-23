import {
  buildNegativeProofsArtifact,
  formatNegativeProofsBadgeLabel,
} from "../../core/negative-proofs-artifact";
import { readActiveSystemState } from "../../core/state";
import { auditThreeEyeAdapters } from "../../services/hl-telemetry-probe";

const BADGE_WIDTH = 220;
const PROOFS_BADGE_WIDTH = 260;
const BADGE_HEIGHT = 20;
const BADGE_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** GitHub README badge — fixed 220×20 SVG per grant DX spec (c16). */
export function buildFailClosedBadgeSvg(active = true): string {
  const label = active
    ? "🛡️ 500ms Fail-Closed: ACTIVE"
    : "🛡️ 500ms Fail-Closed: TRIPPED";
  const fill = active ? "#00ff88" : "#ff4444";
  const safeLabel = escapeXml(label);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}">`,
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" fill="#0d1117" rx="3"/>`,
    `<text x="10" y="14" fill="${fill}" font-family="monospace" font-size="11">${safeLabel}</text>`,
    `</svg>`,
  ].join("");
}

/** SliverVine shield mark — left badge iconography (subtle #00ff88). */
function buildSilvervineShieldMarkSvg(): string {
  return [
    `<g transform="translate(3,2) scale(0.62)">`,
    `<path d="M12 2 L22 6 V12 C22 18 17 21 12 22 C7 21 2 18 2 12 V6 Z" fill="#00ff88" opacity="0.28"/>`,
    `<path d="M12 4 L20 7 V12 C20 16 16 18 12 19 C8 18 4 16 4 12 V7 Z" fill="none" stroke="#00ff88" stroke-width="1.4" opacity="0.9"/>`,
    `<path d="M12 8 V14 M9 11 H15" stroke="#00ff88" stroke-width="1.1" opacity="0.75"/>`,
    `</g>`,
  ].join("");
}

/** GitHub README badge — fixed 260×20 SVG for negative-path proof posture. */
export function buildProofsBadgeSvg(verified = true): string {
  const artifact = buildNegativeProofsArtifact();
  const label = verified
    ? formatNegativeProofsBadgeLabel(artifact)
    : `[ 🛡️ SliverVine | 0/5 FAIL-CLOSED PROOFS: PENDING ]`;
  const fill = verified ? "#00ff88" : "#ff4444";
  const safeLabel = escapeXml(label);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PROOFS_BADGE_WIDTH}" height="${BADGE_HEIGHT}">`,
    `<rect width="${PROOFS_BADGE_WIDTH}" height="${BADGE_HEIGHT}" fill="#0d1117" rx="3"/>`,
    buildSilvervineShieldMarkSvg(),
    `<text x="17" y="14" fill="${fill}" font-family="monospace" font-size="9.5">${safeLabel}</text>`,
    `</svg>`,
  ].join("");
}

/** GET /api/badge/proofs — SVG badge for CI-verified fail-closed negative proofs. */
export function handleBadgeProofsRequest(): Response {
  try {
    const artifact = buildNegativeProofsArtifact();
    const verified = artifact.overallVerdict === "PASS";
    const svg = buildProofsBadgeSvg(verified);

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml;charset=utf-8",
        "Cache-Control": BADGE_CACHE_CONTROL,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[badge/proofs] handler failed", err);
    return new Response(buildProofsBadgeSvg(false), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml;charset=utf-8",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

/** GET /api/badge/health — GitHub-style SVG badge for fail-closed telemetry posture. */
export function handleBadgeHealthRequest(): Response {
  try {
    const state = readActiveSystemState();
    auditThreeEyeAdapters(state);
    const active = !state.hardlock && state.signingChannelOpen !== false;
    const svg = buildFailClosedBadgeSvg(active);

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml;charset=utf-8",
        "Cache-Control": BADGE_CACHE_CONTROL,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[badge/health] handler failed", err);
    return new Response(buildFailClosedBadgeSvg(false), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml;charset=utf-8",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
