/** Cron — GMX DataStore ETH delta vs HL ETH short hedge tick (fail-closed). */
import type { Env } from "../env";
import { checkSoilResistanceWithArbFallback } from "../services/risk-control-lib/soil-arb-probe-refresh";
import { buildLiveHedgeSoilInput } from "../services/gmx-cross-wallet-hedge-lib/build-hedge-soil-input";
import {
  fetchGmxEthDeltaForWallet,
  fetchHlEthMarkUsdStrict,
  GMX_WALLET_B_DEFAULT,
} from "../services/gmx-eth-delta";
import {
  executeGmxCrossWalletHedge,
  executeGmxCrossWalletUnwind,
  fetchWalletAEthShortSize,
  HL_WALLET_A_DEFAULT,
} from "../services/gmx-cross-wallet-hedge";
import { GMX_ETH_USD_MARKET_TOKEN } from "../services/adapters/gmx-v2-gm-balance";
import { buildGmxV2UnsignedOrderPayload } from "../services/adapters/gmx-v2-order-payload";
import { evaluateGmxBalancerQualification } from "../services/yield/gmx-v2-balancer";
import { evaluateEscalationLadder } from "../services/risk/escalation-ladder";
import {
  buildFlashUnwindPlan,
  dispatchEscalationFlashUnwind,
  type PositionLegSnapshot,
} from "../services/risk/flash-unwind";
import { HL_ETH_PERP_ASSET_INDEX, HL_ETH_SZ_DECIMALS } from "../services/hl-auto-hedge-status";
import {
  CRON_FLASH_UNWIND,
  CRON_SKIP_BALANCED,
  CRON_SKIP_CIRCUIT,
  CRON_UNWIND_OVERHEDGE,
  computeCronDriftUsd,
  computeCronOverhedgeUsd,
  resolveCronRebalanceAction,
} from "./scheduled-gmx-hedge-drift";

/** Unsigned GMX MarketDecrease signal — liquidity un-stake / de-lever (no broadcast). */
export function emitGmxDecreaseSignal(input: {
  sizeUsd: number;
  midPriceUsd: number;
  marketToken?: string;
  isLong?: boolean;
}): ReturnType<typeof buildGmxV2UnsignedOrderPayload> {
  return buildGmxV2UnsignedOrderPayload({
    side: input.isLong === false ? "short" : "long",
    sizeUsd: input.sizeUsd,
    reduceOnly: true,
    marketToken: input.marketToken ?? GMX_ETH_USD_MARKET_TOKEN,
    midPriceUsd: input.midPriceUsd,
  });
}

function resolveCronWallets(env: Env): {
  sessionPk: string | null;
  walletA: string;
  walletB: string;
} {
  const sessionPk =
    env.HYPERLIQUID_MAINNET_SESSION_PK?.trim() ||
    env.SRV_200_MAINNET_SESSION_PK?.trim() ||
    null;
  const walletA =
    env.HYPERLIQUID_MAINNET_USER_ADDRESS?.trim() || HL_WALLET_A_DEFAULT;
  const walletB =
    env.SRV_200_MAINNET_USER_ADDRESS?.trim() || GMX_WALLET_B_DEFAULT;
  return { sessionPk, walletA, walletB };
}

function buildCronEthShortPlan(hlShortEth: number, ethMark: number): PositionLegSnapshot[] {
  if (!(hlShortEth > 0) || !(ethMark > 0)) return [];
  return [
    {
      market: "perp",
      asset: HL_ETH_PERP_ASSET_INDEX,
      szi: -hlShortEth,
      midPx: ethMark,
      szDecimals: HL_ETH_SZ_DECIMALS,
      coin: "ETH",
    },
  ];
}

/** Non-throwing cron tick — soil gate → two-way drift probe → hedge / unwind / RED flash. */
export async function runScheduledGmxHedgeCron(env: Env): Promise<void> {
  const { sessionPk, walletA, walletB } = resolveCronWallets(env);
  if (!sessionPk) {
    console.warn("[cron-gmx-hedge] skipped — session PK env binding missing");
    return;
  }

  const fetchFn = fetch;
  try {
    const ethMark = await fetchHlEthMarkUsdStrict(fetchFn);
    const delta = await fetchGmxEthDeltaForWallet(walletB, { fetchFn });
    const hlShortEth = await fetchWalletAEthShortSize(walletA, fetchFn);
    const driftUsd = computeCronDriftUsd(delta.ethDeltaUsd, hlShortEth, ethMark);
    const overhedgeUsd = computeCronOverhedgeUsd(delta.ethDeltaUsd, hlShortEth, ethMark);
    const probeOrderUsd = Math.max(driftUsd, overhedgeUsd, 10);
    const liveSoilInput = await buildLiveHedgeSoilInput({
      symbol: "ETH",
      orderUsd: probeOrderUsd,
      gmxReferenceMidUsd: delta.ethMidUsd || ethMark,
      fetchFn,
    });
    const soil = await checkSoilResistanceWithArbFallback(liveSoilInput);
    const hedgedUsd = hlShortEth * ethMark;
    const live = env.IS_MAINNET === "true";

    if (soil.tripped) {
      const ladder = evaluateEscalationLadder({
        liquidationDistancePct: 0,
        shortNotionalUsd: hedgedUsd,
      });
      const plan = buildFlashUnwindPlan({
        openOrders: [],
        positions: buildCronEthShortPlan(hlShortEth, ethMark),
      });
      const timed = await dispatchEscalationFlashUnwind({
        ladder,
        soilTripped: true,
        plan,
        broadcast: async () => {
          /* cron: unsigned / dry-run unless panic-flash --live */
        },
      });
      console.warn(CRON_FLASH_UNWIND, {
        reasons: soil.reasons.join("|"),
        elapsedMs: timed?.elapsedMs,
        ok: timed?.ok,
      });
      return;
    }

    const action = resolveCronRebalanceAction(driftUsd, overhedgeUsd);
    if (action === "skip-balanced") {
      console.info(CRON_SKIP_BALANCED, {
        driftUsd,
        overhedgeUsd,
        hedgedUsd,
        ethDeltaUsd: delta.ethDeltaUsd,
      });
      return;
    }

    if (action === "unwind") {
      const balancer = evaluateGmxBalancerQualification({
        orderSizeUsd: overhedgeUsd,
        isLong: true,
        reduceOnly: true,
        pool: {
          longTokenUsd: Math.max(delta.ethDeltaUsd, 1),
          shortTokenUsd: Math.max(hedgedUsd, 1),
        },
      });
      const decrease = emitGmxDecreaseSignal({
        sizeUsd: overhedgeUsd,
        midPriceUsd: ethMark,
      });
      const result = await executeGmxCrossWalletUnwind({
        sessionPk,
        walletA,
        walletB,
        dryRun: !live,
        fetchFn,
      });
      console.info(CRON_UNWIND_OVERHEDGE, JSON.stringify({
        ok: result.ok,
        dryRun: result.dryRun,
        overhedgeUsd,
        orderUsd: result.orderUsd,
        decreaseOrderType: decrease.orderType,
        decreaseQualified: balancer.isGmxDecreaseQualified,
        reason: result.reason,
      }));
      return;
    }

    const result = await executeGmxCrossWalletHedge({
      sessionPk,
      walletA,
      walletB,
      dryRun: !live,
      fetchFn,
    });
    console.info("[cron-gmx-hedge] tick", JSON.stringify({
      ok: result.ok,
      dryRun: result.dryRun,
      driftUsd,
      orderUsd: result.orderUsd,
      reason: result.reason,
    }));
  } catch (err) {
    console.warn(
      CRON_SKIP_CIRCUIT,
      err instanceof Error ? err.message : String(err),
    );
  }
}
