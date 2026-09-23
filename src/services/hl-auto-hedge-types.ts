import type { Env } from "../env";

export type HlAutoHedgeEnv = Pick<
  Env,
  "SRV_200_MAINNET_SESSION_PK" | "SRV_200_MAINNET_USER_ADDRESS" | "ARB_MAINNET_USER_ADDRESS" | "IS_MAINNET"
>;

export interface HlAutoHedgeResult {
  ok: boolean;
  dryRun: boolean;
  sizeUsd: number;
  symbol: string;
  reason?: string;
}
