import {
  MAX_ORDER_CLIP_USD,
  MICRO_CAPITAL_USD,
} from "../../config/risk-parameters";
import { postInfo } from "./mainnet-monitor-fetch";
import type { PositionHealthSnapshot } from "./mainnet-monitor-types";

export async function auditDeltaNeutralHealth(
  userAddress: string,
): Promise<PositionHealthSnapshot> {
  const notes: string[] = [];
  let spotUsdcUsd = 0;
  let perpsEquityUsd = 0;
  let openPerpPositions = 0;

  try {
    const ch = (await postInfo({
      type: "clearinghouseState",
      user: userAddress,
    })) as {
      marginSummary?: { accountValue?: string };
      assetPositions?: Array<{ position?: { szi?: string; coin?: string } }>;
    };
    perpsEquityUsd = parseFloat(ch.marginSummary?.accountValue ?? "0") || 0;
    for (const row of ch.assetPositions ?? []) {
      const szi = Math.abs(parseFloat(row.position?.szi ?? "0") || 0);
      if (szi > 0) openPerpPositions += 1;
    }
  } catch (err) {
    notes.push(
      `clearinghouse:${err instanceof Error ? err.message : "error"}`,
    );
  }

  try {
    const spot = (await postInfo({
      type: "spotClearinghouseState",
      user: userAddress,
    })) as { balances?: Array<{ coin?: string; total?: string }> };
    for (const bal of spot.balances ?? []) {
      const coin = (bal.coin ?? "").toUpperCase();
      if (coin === "USDC" || coin === "USDT") {
        spotUsdcUsd += parseFloat(bal.total ?? "0") || 0;
      }
    }
  } catch (err) {
    notes.push(`spot:${err instanceof Error ? err.message : "error"}`);
  }

  const unifiedAvailableUsd =
    spotUsdcUsd > 0 && perpsEquityUsd <= 0
      ? spotUsdcUsd
      : Math.max(spotUsdcUsd + perpsEquityUsd, spotUsdcUsd, perpsEquityUsd);

  let health: PositionHealthSnapshot["health"] = "OK";
  if (unifiedAvailableUsd < MAX_ORDER_CLIP_USD) {
    health = "FAIL";
    notes.push("UNIFIED_BELOW_CLIP");
  } else if (unifiedAvailableUsd < MICRO_CAPITAL_USD * 0.85) {
    health = "WARN";
    notes.push("UNIFIED_BELOW_MICRO_CAPITAL_FLOOR");
  }
  if (openPerpPositions > 0) {
    notes.push(`OPEN_PERP_LEGS=${openPerpPositions}`);
  }

  return {
    unifiedAvailableUsd,
    spotUsdcUsd,
    perpsEquityUsd,
    openPerpPositions,
    clipUsd: MAX_ORDER_CLIP_USD,
    health,
    notes,
  };
}
