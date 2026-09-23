/** Multi-wallet yield routing - Wallet A (HL) + Wallet B (GMX GM) SSOT. */
import type { Env } from "../../env";
import { resolveDualWalletEnv } from "../../env-grant-defaults";
import { computeEffectiveMaxSlUsd } from "../effective-max-sl";
import type { DualWalletTelemetrySnapshot } from "../dual-wallet-telemetry";
import {
  GMX_DEFAULT_UI_FEE_RECEIVER,
  resolveGmxUiFeeReceiver,
} from "../adapters/gmx-v2-order-payload";
import type { GmxV2AdapterOptions } from "../adapters/gmx-v2-adapter.types";

export const MULTI_WALLET_MODE_5 = "MODE_5_DELTA_STRADDLE" as const;

export type MultiWalletYieldMode = typeof MULTI_WALLET_MODE_5;

export interface MultiWalletRoleBinding {
  address: string;
  sessionPk: string | null;
  venue: "hyperliquid" | "gmx-gm";
}

export interface MultiWalletYieldBindings {
  mode: MultiWalletYieldMode;
  walletA: MultiWalletRoleBinding;
  walletB: MultiWalletRoleBinding;
  gmxUiFeeReceiver: string;
  gmxAdapterOpts: GmxV2AdapterOptions;
  combinedEquityUsd: number;
  dynamicMaxSlUsd: number;
}

export type MultiWalletYieldEnv = Pick<
  Env,
  | "HYPERLIQUID_MAINNET_USER_ADDRESS"
  | "HYPERLIQUID_MAINNET_SESSION_PK"
  | "SRV_200_MAINNET_USER_ADDRESS"
  | "SRV_200_MAINNET_SESSION_PK"
  | "ARB_MAINNET_USER_ADDRESS"
  | "GMX_UI_FEE_RECEIVER"
  | "IS_MAINNET"
>;

function pickSessionPk(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function resolveGmxAdapterOptsFromEnv(
  env: Pick<Env, "GMX_UI_FEE_RECEIVER">,
): GmxV2AdapterOptions {
  const uiFeeReceiver = resolveGmxUiFeeReceiver(
    { uiFeeReceiver: env.GMX_UI_FEE_RECEIVER },
    {},
  );
  return {
    uiFeeReceiver: uiFeeReceiver || GMX_DEFAULT_UI_FEE_RECEIVER,
    workerEnv: env,
  };
}

export function computeCombinedWalletEquityUsd(
  telemetry: DualWalletTelemetrySnapshot | null | undefined,
): number {
  if (!telemetry) return 0;
  return (
    (telemetry.walletA?.totalUsd ?? 0) +
    (telemetry.walletB?.perpsMarginUsd ?? 0) +
    (telemetry.gmxGmLiquidityUsd ?? 0)
  );
}

/** Resolve Wallet A (HL execution) + Wallet B (GMX GM endorsement) binding and dynamic Max SL. */
export function resolveMultiWalletYieldBindings(
  env: MultiWalletYieldEnv,
  telemetry?: DualWalletTelemetrySnapshot | null,
): MultiWalletYieldBindings {
  const dual = resolveDualWalletEnv(env);
  const combinedEquityUsd = Math.max(
    computeCombinedWalletEquityUsd(telemetry),
    1_000,
  );
  const gmxAdapterOpts = resolveGmxAdapterOptsFromEnv(env);
  return {
    mode: MULTI_WALLET_MODE_5,
    walletA: {
      address: dual.HYPERLIQUID_MAINNET_USER_ADDRESS,
      sessionPk: pickSessionPk(env.HYPERLIQUID_MAINNET_SESSION_PK),
      venue: "hyperliquid",
    },
    walletB: {
      address: dual.SRV_200_MAINNET_USER_ADDRESS,
      sessionPk: pickSessionPk(env.SRV_200_MAINNET_SESSION_PK),
      venue: "gmx-gm",
    },
    gmxUiFeeReceiver: gmxAdapterOpts.uiFeeReceiver ?? GMX_DEFAULT_UI_FEE_RECEIVER,
    gmxAdapterOpts,
    combinedEquityUsd,
    dynamicMaxSlUsd: computeEffectiveMaxSlUsd(combinedEquityUsd),
  };
}

export function assertOrderWithinDynamicMaxSl(
  orderUsd: number,
  combinedEquityUsd: number,
): { ok: boolean; dynamicMaxSlUsd: number; reason?: string } {
  const dynamicMaxSlUsd = computeEffectiveMaxSlUsd(combinedEquityUsd);
  if (!Number.isFinite(orderUsd) || orderUsd <= 0) {
    return { ok: false, dynamicMaxSlUsd, reason: "ORDER_USD_INVALID" };
  }
  if (orderUsd > dynamicMaxSlUsd) {
    return {
      ok: false,
      dynamicMaxSlUsd,
      reason: `ORDER_${orderUsd.toFixed(2)}>dynamicMaxSl_${dynamicMaxSlUsd.toFixed(2)}`,
    };
  }
  return { ok: true, dynamicMaxSlUsd };
}

export function resolveHlSessionPkForWalletA(
  bindings: MultiWalletYieldBindings,
): string | null {
  return bindings.walletA.sessionPk ?? bindings.walletB.sessionPk;
}
