/** GMX cross-wallet hedge — HL wallet A position fetch helpers. */
import { HL_INFO_URL } from "../config/constants";
import { buildClearinghouseStateRequest } from "../adapters/hl/wallet/marginChecker";

export { HL_WALLET_A_DEFAULT } from "../config/venue-execution-constants";

async function postHlInfo(
  body: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
}

export async function fetchWalletAEthShortSize(
  userAddress: string,
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  const res = await postHlInfo(buildClearinghouseStateRequest(userAddress), fetchFn);
  if (!res.ok) return 0;
  const ch = (await res.json()) as {
    assetPositions?: Array<{ position?: { coin?: string; szi?: string } }>;
  };
  for (const row of ch.assetPositions ?? []) {
    const coin = (row.position?.coin ?? "").toUpperCase();
    if (coin !== "ETH") continue;
    const szi = parseFloat(row.position?.szi ?? "0") || 0;
    return szi < 0 ? Math.abs(szi) : 0;
  }
  return 0;
}
