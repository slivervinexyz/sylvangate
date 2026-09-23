import {
  assertRpcAllowlisted,
  BROWSER_MIMIC_USER_AGENT,
} from "../../defense/rpc-whitelist";
import { fetchWithRpcFailover } from "../../../adapters/hl/rpc-failover";
import {
  classifyExchangeFetchFailure,
  formatExchangeUnavailableWarning,
} from "../safe-exchange-fetch";
import { HL_TESTNET_INFO_URL } from "../../../config/constants";

const UA_HEADERS = {
  "User-Agent": BROWSER_MIMIC_USER_AGENT,
  Accept: "application/json, text/plain, */*",
} as const;

/** Shared HL info POST (browser-mimic UA + v0.8 RPC failover). */
export async function postHlInfo(
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    return await fetchWithRpcFailover("info", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA_HEADERS },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const reason = classifyExchangeFetchFailure(err).label;
    console.warn(formatExchangeUnavailableWarning("Hyperliquid", reason));
    return new Response(
      JSON.stringify({ error: "RPC_BUFFERED", reason }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function postHlTestnetInfo(
  body: Record<string, unknown>,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  try {
    assertRpcAllowlisted(HL_TESTNET_INFO_URL, ["api.hyperliquid-testnet.xyz"]);
    return await fetchFn(HL_TESTNET_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA_HEADERS },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = classifyExchangeFetchFailure(err).label;
    console.warn(formatExchangeUnavailableWarning("Hyperliquid", reason));
    return new Response(
      JSON.stringify({ error: "HL_TESTNET_BUFFERED", reason }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
