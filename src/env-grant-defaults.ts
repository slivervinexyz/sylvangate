/** Grant-audit Edge env — mainnet wallet address fallbacks when bindings missing. */
import type { Env } from "./env";
import type { DualWalletEnv } from "./services/dual-wallet-telemetry";

export const DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS =
  "0xef0752df6387248B897F3A59A180af42D801960d";
export const DEFAULT_SRV_200_MAINNET_USER_ADDRESS =
  "0xc9BddABD80982d2201376195DD9B85fb7951546f";
export const DEFAULT_ARB_MAINNET_USER_ADDRESS =
  "0xc9BddABD80982d2201376195DD9B85fb7951546f";

export type GrantAuditResolvedEnv = DualWalletEnv &
  Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK" | "IS_MAINNET">;

function pickAddress(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function resolveDualWalletEnv(env: DualWalletEnv = {}): Required<
  Pick<
    DualWalletEnv,
    | "HYPERLIQUID_MAINNET_USER_ADDRESS"
    | "SRV_200_MAINNET_USER_ADDRESS"
    | "ARB_MAINNET_USER_ADDRESS"
  >
> &
  Pick<DualWalletEnv, "SRV_200_MAINNET_SESSION_PK"> {
  return {
    HYPERLIQUID_MAINNET_USER_ADDRESS: pickAddress(
      env.HYPERLIQUID_MAINNET_USER_ADDRESS,
      DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS,
    ),
    SRV_200_MAINNET_USER_ADDRESS: pickAddress(
      env.SRV_200_MAINNET_USER_ADDRESS,
      DEFAULT_SRV_200_MAINNET_USER_ADDRESS,
    ),
    ARB_MAINNET_USER_ADDRESS: pickAddress(
      env.ARB_MAINNET_USER_ADDRESS,
      DEFAULT_ARB_MAINNET_USER_ADDRESS,
    ),
    SRV_200_MAINNET_SESSION_PK: env.SRV_200_MAINNET_SESSION_PK,
  };
}

/** Merge Cloudflare Edge bindings with grant-audit mainnet wallet SSOT defaults. */
export function resolveGrantAuditEnv(env: Env): GrantAuditResolvedEnv {
  const dual = resolveDualWalletEnv(env);
  return {
    ...env,
    ...dual,
  };
}
