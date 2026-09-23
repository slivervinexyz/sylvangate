/** GET /api/robinhood-audit-snapshot — Robinhood Chain AML cut-off audit certificate. */
import { buildRobinhoodAuditSnapshot } from "../../sdk/robinhood-audit-snapshot";
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../../sdk/constants";
import { CORS_JSON_HEADERS } from "../../services/config";

export function isRobinhoodAuditSnapshotPath(pathname: string): boolean {
  return pathname === "/api/robinhood-audit-snapshot";
}

export function handleRobinhoodAuditSnapshotRequest(request: Request): Response {
  const url = new URL(request.url);
  const chainParam = Number(url.searchParams.get("chainId") ?? ROBINHOOD_TESTNET_CHAIN_ID);
  const robinhoodChainId =
    chainParam === ROBINHOOD_MAINNET_CHAIN_ID
      ? ROBINHOOD_MAINNET_CHAIN_ID
      : ROBINHOOD_TESTNET_CHAIN_ID;
  const amountUsd = Math.max(0, Number(url.searchParams.get("amountUsd") ?? 0) || 0);
  const nowMs = Date.now();

  try {
    const snapshot = buildRobinhoodAuditSnapshot({
      robinhoodChainId,
      amountUsd,
      nowMs,
      initiatedAtMs: nowMs,
    });
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: CORS_JSON_HEADERS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Robinhood audit snapshot failed";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 422,
      headers: CORS_JSON_HEADERS,
    });
  }
}
