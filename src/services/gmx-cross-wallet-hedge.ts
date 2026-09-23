/** GMX Wallet B ETH delta → Wallet A Hyperliquid ETH perp short (0-Δ cross-wallet). */
export { HEDGE_SOIL_L2_TRIP } from "./gmx-cross-wallet-hedge-lib/build-hedge-soil-input";
export { HL_WALLET_A_DEFAULT, fetchWalletAEthShortSize } from "./gmx-cross-wallet-hedge-fetch";
export { runGmxCrossWalletEthHedge } from "./gmx-cross-wallet-hedge-run";
export type { GmxCrossWalletHedgeInput, GmxCrossWalletHedgeResult } from "./gmx-cross-wallet-hedge.types";
import { runGmxCrossWalletEthHedge } from "./gmx-cross-wallet-hedge-run";
import type { GmxCrossWalletHedgeInput, GmxCrossWalletHedgeResult } from "./gmx-cross-wallet-hedge.types";

/** Cron / worker alias — cross-wallet GMX→HL ETH hedge execution. */
export const executeGmxCrossWalletHedge = runGmxCrossWalletEthHedge;

/** Over-hedge unwind — reduce-only HL buy-to-cover to restore 0-Δ. */
export function runGmxCrossWalletEthUnwind(
  input: Omit<GmxCrossWalletHedgeInput, "unwind">,
): Promise<GmxCrossWalletHedgeResult> {
  return runGmxCrossWalletEthHedge({ ...input, unwind: true });
}

export const executeGmxCrossWalletUnwind = runGmxCrossWalletEthUnwind;
