/** GMX cross-wallet hedge — GMX Wallet B delta → HL Wallet A ETH perp short. */
import type { Hex } from "viem";
import { createViemEip712Signer } from "../adapters/hl/viem-eip712-signer";
import { HL_EXCHANGE_URL } from "../config/constants";
import { executeHlSessionKeyOrder } from "../adapters/hl/session-key-executor";
import { formatHlPerpPrice } from "../adapters/hl/execution-wire";
import { sanitizeSessionKeyForMasterWalletTrading } from "../adapters/hl/execution-types";
import { buildSystemState } from "../core/state";
import { computeDeltaNeutralHedgeOrder, computeHedgeSlippageLimitPx } from "../core/delta-neutral-calculator";
import type { IntentLeg } from "../core/intent-ledger";
import { HL_ETH_PERP_ASSET_INDEX, HL_ETH_SZ_DECIMALS } from "./hl-auto-hedge-status";
import { fetchGmxEthDeltaForWallet, fetchHlEthMarkUsdStrict, GMX_WALLET_B_DEFAULT } from "./gmx-eth-delta";
import { refreshSoilArbitrumProbesWithFallback } from "./risk-control-lib/soil-arb-probe-refresh";
import { buildLiveHedgeSoilInput } from "./gmx-cross-wallet-hedge-lib/build-hedge-soil-input";
import { emitDualWalletHedgeTelemetry } from "./gmx-cross-wallet-hedge-lib/dual-wallet-structured-log";
import { fetchWalletAEthShortSize, HL_WALLET_A_DEFAULT } from "./gmx-cross-wallet-hedge-fetch";
import {
  assertWalletAMarginSufficiency,
  computeJitRebalanceRequiredMarginUsd,
  fetchWalletAMarginBalanceUsd,
  INSUFFICIENT_WALLETA_HEDGE_MARGIN,
} from "./cross-wallet-cold-start-guard";
import type { GmxCrossWalletHedgeInput, GmxCrossWalletHedgeResult } from "./gmx-cross-wallet-hedge.types";

export async function runGmxCrossWalletEthHedge(input: GmxCrossWalletHedgeInput): Promise<GmxCrossWalletHedgeResult> {
  const walletA = (input.walletA ?? HL_WALLET_A_DEFAULT).trim();
  const walletB = (input.walletB ?? GMX_WALLET_B_DEFAULT).trim();
  const delta = await fetchGmxEthDeltaForWallet(walletB, { fetchFn: input.fetchFn });
  const existingShort = await fetchWalletAEthShortSize(walletA, input.fetchFn);
  emitDualWalletHedgeTelemetry({
    walletA,
    walletB,
    ethDeltaSize: delta.ethDeltaSize,
    gmLiquidityUsd: delta.gmLiquidityUsd,
    existingShortEth: existingShort,
    unwind: input.unwind,
  });
  const reduceOnly = input.unwind === true;
  const preSizing = computeDeltaNeutralHedgeOrder({
    ethDeltaSize: delta.ethDeltaSize,
    existingShortEth: existingShort,
    unwind: input.unwind,
    limitPxUsd: 1,
  });
  if (!preSizing.ok) {
    return {
      ok: false,
      dryRun: input.dryRun !== false,
      ethDeltaSize: delta.ethDeltaSize,
      ethDeltaUsd: delta.ethDeltaUsd,
      orderEthSize: 0,
      orderUsd: 0,
      reason: preSizing.reason,
      delta,
    };
  }

  await refreshSoilArbitrumProbesWithFallback();
  const live = input.dryRun !== true;
  const ethMarkUsd = await fetchHlEthMarkUsdStrict(input.fetchFn);
  const slipPx = computeHedgeSlippageLimitPx(ethMarkUsd, reduceOnly);
  const shortLimitPx = formatHlPerpPrice(slipPx, HL_ETH_SZ_DECIMALS);
  const sizing = computeDeltaNeutralHedgeOrder({
    ethDeltaSize: delta.ethDeltaSize,
    existingShortEth: existingShort,
    unwind: input.unwind,
    limitPxUsd: shortLimitPx,
  });
  if (!sizing.ok) {
    return {
      ok: false,
      dryRun: input.dryRun !== false,
      ethDeltaSize: delta.ethDeltaSize,
      ethDeltaUsd: delta.ethDeltaUsd,
      orderEthSize: 0,
      orderUsd: 0,
      reason: sizing.reason,
      delta,
    };
  }
  const { orderEthSize, orderUsd } = sizing;
  if (!reduceOnly) {
    try {
      const walletABalanceUsd = await fetchWalletAMarginBalanceUsd(walletA, input.fetchFn);
      assertWalletAMarginSufficiency(
        walletABalanceUsd,
        computeJitRebalanceRequiredMarginUsd(orderUsd),
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (reason !== INSUFFICIENT_WALLETA_HEDGE_MARGIN) throw err;
      return {
        ok: false,
        dryRun: input.dryRun !== false,
        ethDeltaSize: delta.ethDeltaSize,
        ethDeltaUsd: delta.ethDeltaUsd,
        orderEthSize: 0,
        orderUsd: 0,
        reason: INSUFFICIENT_WALLETA_HEDGE_MARGIN,
        delta,
      };
    }
  }
  const signer = createViemEip712Signer(input.sessionPk as Hex);
  const leg: IntentLeg = {
    venue: "HL",
    side: reduceOnly ? "LONG" : "SHORT",
    sizeUsd: orderUsd,
    symbol: "ETH",
  };
  const riskBalanceUsd = Math.max(orderUsd / 0.01, delta.gmLiquidityUsd, 10_000);
  const liveSoil = await buildLiveHedgeSoilInput({
    symbol: "ETH",
    orderUsd,
    gmxReferenceMidUsd: delta.ethMidUsd || ethMarkUsd,
    fetchFn: input.fetchFn,
  });
  const result = await executeHlSessionKeyOrder(leg, {
    signer,
    dryRun: !live,
    isTestnet: false,
    exchangeUrl: HL_EXCHANGE_URL,
    marketIoc: true,
    limitPx: shortLimitPx,
    szDecimals: HL_ETH_SZ_DECIMALS,
    reduceOnly,
    resolveAssetIndex: () => HL_ETH_PERP_ASSET_INDEX,
    fetchFn: input.fetchFn,
    sessionKey: sanitizeSessionKeyForMasterWalletTrading(
      {
        agentAddress: signer.address,
        expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
        masterWalletAddress: walletA,
      },
      walletA,
    ),
    systemState: buildSystemState({
      accountBalanceUsd: riskBalanceUsd,
      currentCri: 100,
      skipHardlockAssert: true,
    }),
    preTrade: {
      ...liveSoil,
      latencyMs: 50,
      expectedSlippage: 0.0005,
      accountBalanceUsd: riskBalanceUsd,
    },
  });

  return {
    ok: result.ok,
    dryRun: !live,
    ethDeltaSize: delta.ethDeltaSize,
    ethDeltaUsd: delta.ethDeltaUsd,
    orderEthSize,
    orderUsd,
    exchangeOid: result.exchangeOid,
    reason: result.reason,
    delta,
  };
}
