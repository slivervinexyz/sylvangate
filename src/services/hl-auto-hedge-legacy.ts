/** @deprecated Legacy HL auto-hedge sizing — tests only; production uses cross-wallet hedge. */
import type { Hex } from "viem";
import { createViemEip712Signer } from "../adapters/hl/viem-eip712-signer";
import { HL_EXCHANGE_URL } from "../config/constants";
import { executeHlSessionKeyOrder } from "../adapters/hl/session-key-executor";
import { sanitizeSessionKeyForMasterWalletTrading } from "../adapters/hl/execution-types";
import { buildSystemState } from "../core/state";
import { getGmxGmBalanceCache } from "./adapters/gmx-v2-gm-balance";
import { getHlWalletTelemetryCache } from "./hl-wallet-telemetry";
import { resolveLiveEthMidUsd } from "./hl-auto-hedge-live-eth";
import { computeAutoHedgeSizeUsd } from "./hl-auto-hedge-size";
import type { HlAutoHedgeEnv, HlAutoHedgeResult } from "./hl-auto-hedge-types";
import { resolveSrv200UserAddress } from "./hl-auto-hedge-resolve";
import { HL_ETH_PERP_ASSET_INDEX, HL_ETH_SZ_DECIMALS, __readHlAutoHedgeStatusRef } from "./hl-auto-hedge-status";

function resolveHedgeRiskBalanceUsd(gmUsd: number, marginUsd: number, sizeUsd: number): number {
  const slFloor = (sizeUsd - 100) / 0.01;
  return Math.max(gmUsd + marginUsd, slFloor, sizeUsd);
}

function resolveExomeshGrantMode(opts: { exomeshGrantMode?: boolean }): boolean {
  return opts.exomeshGrantMode === true || process.env.EXOMESH_GRANT_MODE === "true";
}

export async function runLegacyHlAutoHedge(
  env: HlAutoHedgeEnv,
  opts: {
    dryRun?: boolean;
    fetchFn?: typeof fetch;
    exomeshGrantMode?: boolean;
  },
): Promise<HlAutoHedgeResult> {
  const hedgeStatus = __readHlAutoHedgeStatusRef();
  const sessionPk = env.SRV_200_MAINNET_SESSION_PK!.trim();
  const userAddress = resolveSrv200UserAddress(env)!;
  const symbol = "ETH";
  const gm = getGmxGmBalanceCache();
  const hl = getHlWalletTelemetryCache(userAddress);
  const gmUsd = gm?.gmLiquidityUsd ?? 0;
  const marginUsd = hl?.perpsMarginUsd ?? 0;
  const { px: ethMid } = await resolveLiveEthMidUsd(opts.fetchFn);
  const sizeUsd = computeAutoHedgeSizeUsd(gmUsd, marginUsd, ethMid, {
    exomeshGrantMode: resolveExomeshGrantMode(opts),
  });
  if (sizeUsd <= 0) {
    return { ok: false, dryRun: true, sizeUsd: 0, symbol, reason: "HEDGE_SIZE_ZERO" };
  }
  const live = env.IS_MAINNET === "true" && opts.dryRun !== true;
  const signer = createViemEip712Signer(sessionPk as Hex);
  const result = await executeHlSessionKeyOrder(
    { venue: "HL", side: "SHORT", sizeUsd, symbol },
    {
      signer,
      dryRun: !live,
      isTestnet: false,
      exchangeUrl: HL_EXCHANGE_URL,
      marketIoc: true,
      limitPx: ethMid,
      szDecimals: HL_ETH_SZ_DECIMALS,
      resolveAssetIndex: () => HL_ETH_PERP_ASSET_INDEX,
      fetchFn: opts.fetchFn,
      sessionKey: sanitizeSessionKeyForMasterWalletTrading(
        {
          agentAddress: signer.address,
          expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
          masterWalletAddress: userAddress,
        },
        userAddress,
      ),
      systemState: buildSystemState({
        accountBalanceUsd: resolveHedgeRiskBalanceUsd(gmUsd, marginUsd, sizeUsd),
        currentCri: 100,
        skipHardlockAssert: true,
      }),
    },
  );
  Object.assign(hedgeStatus, {
    hedgeActive: result.ok,
    lastSizeUsd: sizeUsd,
    lastSymbol: symbol,
    lastRunAt: new Date().toISOString(),
    lastReason: result.ok ? null : (result.reason ?? "HL_HEDGE_FAILED"),
  });
  return { ok: result.ok, dryRun: !live, sizeUsd, symbol, reason: result.reason };
}
