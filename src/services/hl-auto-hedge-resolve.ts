import { HL_AUTO_HEDGE_MASTER_WALLET_A } from "./hl-auto-hedge-status";
import type { HlAutoHedgeEnv } from "./hl-auto-hedge-types";

export function resolveSrv200UserAddress(env: HlAutoHedgeEnv): string | null {
  return (
    env.SRV_200_MAINNET_USER_ADDRESS?.trim() ||
    HL_AUTO_HEDGE_MASTER_WALLET_A ||
    env.ARB_MAINNET_USER_ADDRESS?.trim() ||
    null
  );
}
