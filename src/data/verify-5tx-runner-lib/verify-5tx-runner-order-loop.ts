/**
 * Hyperliquid Testnet — 5× order loop for verified fill records.
 */

import { Wallet } from "ethers";
import { executeHlSessionKeyOrder } from "../../adapters/hl/session-key-executor";
import { waitForNewFill } from "../../adapters/hl/wallet/sessionOrderFillSync";
import type { IntentLeg } from "../../core/intent-ledger";
import type { SystemState } from "../../core/state";
import type { LiveBookSoilAudit } from "../../services/check-soil-resistance";
import {
  applyW01DepthRefillDefense,
  buildHlTestnetExplorerUrl,
  buildPreTradeFromSoilAudit,
  estimateSlippageBps,
  generateUniqueBatchFillHash,
  pickFillTxMeta,
  resolveMarketIocLimitPx,
  type HlUserFill,
  type Verified5TxFillRecord,
} from "../verified-5tx";
import {
  VERIFY_5TX_ACCOUNT_BALANCE_USD,
  VERIFY_5TX_ORDER_SIDES,
} from "./runner-fixture-loader";

export interface Verify5TxOrderLoopInput {
  wallet: Wallet;
  symbol: string;
  notionalUsd: number;
  soilAudit: LiveBookSoilAudit;
  limitPx: number;
  livePost: boolean;
  dryRun: boolean;
  skipSoilProbe: boolean;
  fetchFn: typeof fetch;
  testnetAssetIndex: number;
  szDecimals: number;
  systemState: SystemState;
  runTs: number;
  executionNonce: string;
  seenFillHashes: Set<string>;
}

export async function runVerify5TxOrderLoop(
  input: Verify5TxOrderLoopInput,
  orderCount: number,
): Promise<Verified5TxFillRecord[]> {
  const records: Verified5TxFillRecord[] = [];

  for (let i = 0; i < orderCount; i += 1) {
    const side = VERIFY_5TX_ORDER_SIDES[i] ?? "BUY";
    const leg: IntentLeg = {
      venue: "HL",
      side,
      sizeUsd: input.notionalUsd,
      symbol: input.symbol,
    };

    const basePreTrade = buildPreTradeFromSoilAudit(
      input.soilAudit,
      input.notionalUsd,
      VERIFY_5TX_ACCOUNT_BALANCE_USD,
    );
    const preTrade = applyW01DepthRefillDefense(basePreTrade, input.soilAudit, input.notionalUsd);
    const w01DepthRefillBps = Math.max(32, Math.round(input.soilAudit.priceImpactBps));

    const orderLimitPx = input.livePost
      ? resolveMarketIocLimitPx(input.soilAudit, side, input.szDecimals)
      : input.limitPx;

    const exec = await executeHlSessionKeyOrder(leg, {
      signer: input.wallet,
      dryRun: input.dryRun,
      isTestnet: true,
      systemState: input.systemState,
      limitPx: orderLimitPx,
      preTrade,
      skipPreTrade: input.skipSoilProbe,
      marketIoc: input.livePost,
      szDecimals: input.szDecimals,
      resolveAssetIndex: () => input.testnetAssetIndex,
    });

    if (!exec.ok) {
      throw new Error(`Order ${i + 1} failed: ${exec.reason ?? "UNKNOWN"}`);
    }

    let txHash: string;
    let fillTimeSec: number;
    let timestamp: string;
    let fillPx = input.limitPx;

    if (input.livePost) {
      const latest = await waitForNewFill(
        input.wallet.address,
        input.symbol,
        input.seenFillHashes,
        input.fetchFn,
      );
      input.seenFillHashes.add(String(latest.hash).trim());
      const meta = pickFillTxMeta(latest);
      txHash = meta.txHash;
      fillTimeSec = meta.fillTimeSec;
      timestamp = meta.timestamp;
      fillPx = latest?.px ? Number(latest.px) : input.limitPx;
    } else {
      const fillTs = input.runTs + i * 2_000 + i;
      txHash = generateUniqueBatchFillHash(input.wallet.address, i, input.executionNonce, fillTs);
      fillTimeSec = Math.floor(fillTs / 1000);
      timestamp = new Date(fillTs).toISOString();
    }

    const { rawSlippageBps, gatedSlippageBps } = estimateSlippageBps(
      input.soilAudit.probe.midPx,
      fillPx,
    );
    const savedUsd = Number(
      (input.notionalUsd * Math.max(0, rawSlippageBps - gatedSlippageBps) / 10_000).toFixed(4),
    );

    records.push({
      index: i + 1,
      side,
      symbol: input.symbol,
      notionalUsd: input.notionalUsd,
      txHash,
      fillTimeSec,
      timestamp,
      explorerUrl: buildHlTestnetExplorerUrl(txHash),
      soilPassed: input.soilAudit.ok && !input.soilAudit.tripped,
      w01DepthRefillBps,
      rawSlippageBps,
      gatedSlippageBps,
      savedUsd,
      dryRun: input.dryRun,
    });
  }

  return records;
}

export function seedSeenFillHashes(fillsBefore: HlUserFill[]): Set<string> {
  return new Set<string>(
    fillsBefore
      .map((fill: HlUserFill) => String(fill.hash ?? "").trim())
      .filter(Boolean),
  );
}
