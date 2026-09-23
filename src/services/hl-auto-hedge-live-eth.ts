/** Live HL ETH mid/mark for auto-hedge — FALLBACK_ONLY on RPC failure. */
import { fetchHlEthMarkUsdStrict } from "./gmx-eth-delta";
import { HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD } from "./hl-auto-hedge-status";

export type EthMidSource = "live-rpc" | "fallback-only";

export interface ResolvedEthMidUsd {
  px: number;
  source: EthMidSource;
}

export async function resolveLiveEthMidUsd(
  fetchFn: typeof fetch = fetch,
): Promise<ResolvedEthMidUsd> {
  try {
    const px = await fetchHlEthMarkUsdStrict(fetchFn);
    return { px, source: "live-rpc" };
  } catch (err) {
    console.warn(
      JSON.stringify({
        tag: "HL_ETH_MID_FALLBACK_ONLY",
        timestamp: new Date().toISOString(),
        fallbackUsd: HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { px: HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD, source: "fallback-only" };
  }
}
