/**
 * Automated HL Session Key short hedge — delegates to delta-based cross-wallet hedge (SSOT).
 */
import { getGmxGmBalanceCache } from "./adapters/gmx-v2-gm-balance";
import { GMX_WALLET_B_DEFAULT } from "./gmx-eth-delta";
import { executeGmxCrossWalletHedge } from "./gmx-cross-wallet-hedge";
import { runLegacyHlAutoHedge } from "./hl-auto-hedge-legacy";
import { resolveSrv200UserAddress } from "./hl-auto-hedge-resolve";
import { isGmxTelemetrySafeForSizing } from "./hl-auto-hedge-size";
import { HL_AUTO_HEDGE_COOLDOWN_MS, __readHlAutoHedgeStatusRef } from "./hl-auto-hedge-status";
import type { HlAutoHedgeEnv, HlAutoHedgeResult } from "./hl-auto-hedge-types";

export { computeAutoHedgeSizeUsd, isGmxTelemetrySafeForSizing, HL_AUTO_HEDGE_LEGACY_SIZING_DEPRECATED, type ComputeAutoHedgeSizeUsdOptions } from "./hl-auto-hedge-size";

export {
  HL_AUTO_HEDGE_MIN_MARGIN_USD,
  HL_AUTO_HEDGE_COOLDOWN_MS,
  HL_AUTO_HEDGE_MASTER_WALLET_A,
  HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD,
  HL_AUTO_HEDGE_MIN_NOTIONAL_USD,
  HL_AUTO_HEDGE_MAX_NOTIONAL_USD,
  HL_ETH_PERP_ASSET_INDEX,
  HL_ETH_SZ_DECIMALS,
  HL_AUTO_HEDGE_TARGET_HYPE_QTY,
  HL_AUTO_HEDGE_TARGET_HYPE_QTY_MIN,
  HL_AUTO_HEDGE_TARGET_HYPE_QTY_MAX,
  HL_AUTO_HEDGE_HYPE_MID_FALLBACK_USD,
  HL_HYPE_PERP_ASSET_INDEX,
  HL_HYPE_SZ_DECIMALS,
  getHlAutoHedgeStatus,
  type HlAutoHedgeStatus,
  __setHlAutoHedgeStatusForTests,
  __resetHlAutoHedgeStatusForTests,
} from "./hl-auto-hedge-status";

export type { HlAutoHedgeEnv, HlAutoHedgeResult } from "./hl-auto-hedge-types";
export { resolveSrv200UserAddress } from "./hl-auto-hedge-resolve";

export async function runHlAutoHedgeForGmxGm(
  env: HlAutoHedgeEnv,
  opts: {
    dryRun?: boolean;
    fetchFn?: typeof fetch;
    force?: boolean;
    exomeshGrantMode?: boolean;
    /** @deprecated tests only */
    useLegacySizing?: boolean;
  } = {},
): Promise<HlAutoHedgeResult> {
  const hedgeStatus = __readHlAutoHedgeStatusRef();
  const sessionPk = env.SRV_200_MAINNET_SESSION_PK?.trim() || "";
  const userAddress = resolveSrv200UserAddress(env);
  const symbol = "ETH";
  Object.assign(hedgeStatus, { readOnlyMode: sessionPk.length === 0 });

  if (!userAddress) {
    const reason = "SRV_200_USER_ADDRESS_MISSING";
    Object.assign(hedgeStatus, { lastReason: reason });
    return { ok: false, dryRun: true, sizeUsd: 0, symbol, reason };
  }
  if (!sessionPk) {
    const reason = "SRV_200_SESSION_PK_EMPTY_READ_ONLY";
    Object.assign(hedgeStatus, { lastReason: reason });
    return { ok: false, dryRun: true, sizeUsd: 0, symbol, reason };
  }

  if (opts.useLegacySizing === true) {
    return runLegacyHlAutoHedge(env, opts);
  }

  const gm = getGmxGmBalanceCache();
  if (!isGmxTelemetrySafeForSizing(gm)) {
    const reason = gm?.isCached ? "GM_TELEMETRY_SWR_FALLBACK_BLOCKED" : "GM_TELEMETRY_MISSING";
    Object.assign(hedgeStatus, { lastReason: reason });
    return { ok: false, dryRun: true, sizeUsd: 0, symbol, reason };
  }

  const lastRun = hedgeStatus.lastRunAt ? Date.parse(hedgeStatus.lastRunAt) : 0;
  if (!opts.force && lastRun > 0 && Date.now() - lastRun < HL_AUTO_HEDGE_COOLDOWN_MS) {
    return { ok: hedgeStatus.hedgeActive, dryRun: false, sizeUsd: hedgeStatus.lastSizeUsd ?? 0, symbol };
  }

  const walletB = env.ARB_MAINNET_USER_ADDRESS?.trim() || GMX_WALLET_B_DEFAULT;
  const live = env.IS_MAINNET === "true" && opts.dryRun !== true;
  const result = await executeGmxCrossWalletHedge({
    sessionPk,
    walletA: userAddress,
    walletB,
    dryRun: !live,
    fetchFn: opts.fetchFn,
  });
  const ok = result.ok || result.reason === "ETH_HEDGE_ALREADY_COVERED";
  Object.assign(hedgeStatus, {
    hedgeActive: ok,
    lastSizeUsd: result.orderUsd,
    lastSymbol: symbol,
    lastRunAt: new Date().toISOString(),
    readOnlyMode: false,
    lastReason: ok ? null : (result.reason ?? "HL_HEDGE_FAILED"),
  });
  return { ok, dryRun: result.dryRun, sizeUsd: result.orderUsd, symbol, reason: result.reason };
}
