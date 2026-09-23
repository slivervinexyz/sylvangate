/** Worker-edge SVG badges — no hl-telemetry-probe dependency. */
import {
  formatNegativeProofsBadgeLabelLean,
  isNegativeProofsVerifiedLean,
} from "../../core/negative-proofs-artifact-lean";
import { readActiveSystemState } from "../../core/state";

const BADGE_WIDTH = 220;
const PROOFS_BADGE_WIDTH = 260;
const BADGE_HEIGHT = 20;
const BADGE_CACHE = "public, max-age=30, stale-while-revalidate=60";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function failClosedSvg(active: boolean): string {
  const label = active ? "🛡️ 500ms Fail-Closed: ACTIVE" : "🛡️ 500ms Fail-Closed: TRIPPED";
  const fill = active ? "#00ff88" : "#ff4444";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"><rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" fill="#0d1117" rx="3"/><text x="10" y="14" fill="${fill}" font-family="monospace" font-size="11">${esc(label)}</text></svg>`;
}

function proofsSvg(verified: boolean): string {
  const label = verified
    ? formatNegativeProofsBadgeLabelLean()
    : "[ 🛡️ SliverVine | 0/5 FAIL-CLOSED PROOFS: PENDING ]";
  const fill = verified ? "#00ff88" : "#ff4444";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PROOFS_BADGE_WIDTH}" height="${BADGE_HEIGHT}"><rect width="${PROOFS_BADGE_WIDTH}" height="${BADGE_HEIGHT}" fill="#0d1117" rx="3"/><text x="10" y="14" fill="${fill}" font-family="monospace" font-size="9.5">${esc(label)}</text></svg>`;
}

export function handleBadgeHealthRequestLean(): Response {
  const state = readActiveSystemState();
  const active = !state.hardlock && state.signingChannelOpen !== false;
  return new Response(failClosedSvg(active), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml;charset=utf-8",
      "Cache-Control": BADGE_CACHE,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function handleBadgeProofsRequestLean(): Response {
  const verified = isNegativeProofsVerifiedLean();
  return new Response(proofsSvg(verified), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml;charset=utf-8",
      "Cache-Control": BADGE_CACHE,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
