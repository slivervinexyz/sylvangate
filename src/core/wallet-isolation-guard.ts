/** Global Wallet B isolation — GM LP vault must never sign GMX perp/short createOrder payloads. */
import { getAddress, type Hex } from "viem";
import { GMX_UI_FEE_RECEIVER } from "../config/gmx-revenue";

export const WALLET_B_PERP_FORBIDDEN = "WALLET_B_PERP_FORBIDDEN" as const;

export const GMX_WALLET_B_ISOLATION_ADDRESS = getAddress(GMX_UI_FEE_RECEIVER);

export function isWalletBIsolationAddress(account: string): boolean {
  try {
    return getAddress(account as Hex) === GMX_WALLET_B_ISOLATION_ADDRESS;
  } catch {
    return false;
  }
}

export function assertWalletBPerpIsolation(account: string): void {
  if (isWalletBIsolationAddress(account)) {
    throw new Error(WALLET_B_PERP_FORBIDDEN);
  }
}

export function assertGmxPerpOrderReceiverIsolation(input: { receiver?: string | null }): void {
  const receiver = input.receiver?.trim();
  if (!receiver || receiver === "0x" || /^0x0+$/i.test(receiver)) return;
  assertWalletBPerpIsolation(receiver);
}
