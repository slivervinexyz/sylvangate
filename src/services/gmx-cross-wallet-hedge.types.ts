/** GMX cross-wallet hedge result types. */
import type { GmxEthDeltaSnapshot } from "./gmx-eth-delta";

export interface GmxCrossWalletHedgeResult {
  ok: boolean;
  dryRun: boolean;
  ethDeltaSize: number;
  ethDeltaUsd: number;
  orderEthSize: number;
  orderUsd: number;
  exchangeOid?: number;
  reason?: string;
  delta: GmxEthDeltaSnapshot;
}

export type GmxCrossWalletHedgeInput = {
  sessionPk: string;
  walletA?: string;
  walletB?: string;
  dryRun?: boolean;
  fetchFn?: typeof fetch;
  /** When true, reduce HL short to match GMX ETH delta (over-hedge unwind). */
  unwind?: boolean;
};
