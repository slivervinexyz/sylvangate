/**
 * Hyperliquid Testnet — 5× $10 hedge/market verification runner (W01 + checkSoilResistance).
 */

import { Wallet } from "ethers";
import {
  fetchUserFills,
  resolveTestnetAssetMeta,
} from "../../adapters/hl/wallet/sessionOrderFillSync";
import { buildSystemState } from "../../core/state";
import {
  VERIFIED_5TX_NOTIONAL_USD,
  VERIFIED_5TX_ORDER_COUNT,
  VERIFIED_5TX_SYMBOL,
  aggregateVerifiedFills,
  createBatchExecutionNonce,
  HL_LIVE_MIN_NOTIONAL_USD,
  type Verified5TxResults,
} from "../verified-5tx";
import { resolveHlTestnetPrivateKey, isFundedHlTestnetPrivateKey } from "../../env/hl-testnet-key";
import {
  VERIFY_5TX_ACCOUNT_BALANCE_USD,
  resolveAssetIndexFallback,
  soilAuditSummary,
} from "./runner-fixture-loader";
import {
  isSkipSoilEnvEnabled,
  resolveRunSoilAudit,
  seedSkipSoilExomeshProbes,
} from "./runner-soil-bypass";
import {
  runVerify5TxOrderLoop,
  seedSeenFillHashes,
} from "./verify-5tx-runner-order-loop";

export interface Verify5TxRunnerOptions {
  privateKey?: string;
  live?: boolean;
  fetchFn?: typeof fetch;
  symbol?: string;
  notionalUsd?: number;
  /** Abort when live soil trips (default true). Dry-run continues with synthetic soil. */
  abortOnSoilTrip?: boolean;
  /** Probe live testnet L2 during dry-run (default false — offline-safe synthetic soil). */
  forceLiveSoil?: boolean;
  /**
   * Testnet smoke bypass: skip live soil probe abort / use synthetic soil when probe trips.
   * Set via `--skip-soil` or SKIP_SOIL_CHECK=1 / SKIP_SOIL_PROBE_CHECK=1.
   */
  skipSoilProbe?: boolean;
}

export async function runVerify5Tx(
  opts: Verify5TxRunnerOptions = {},
): Promise<Verified5TxResults> {
  const privateKey = resolveHlTestnetPrivateKey(opts.privateKey);
  const wantsLive =
    opts.live ?? (process.env.HL_LIVE === "1" || process.env.HL_LIVE === "true");
  const hasFundedKey = isFundedHlTestnetPrivateKey(privateKey);
  const livePost = wantsLive && hasFundedKey;
  const dryRun = !livePost;
  const fetchFn = opts.fetchFn ?? fetch;
  const symbol = opts.symbol ?? VERIFIED_5TX_SYMBOL;
  const notionalUsd = Math.max(opts.notionalUsd ?? VERIFIED_5TX_NOTIONAL_USD, HL_LIVE_MIN_NOTIONAL_USD);
  const abortOnSoilTrip = opts.abortOnSoilTrip ?? true;
  const forceLiveSoil = opts.forceLiveSoil ?? false;
  const skipSoilProbe = opts.skipSoilProbe === true || isSkipSoilEnvEnabled();

  if (skipSoilProbe) {
    seedSkipSoilExomeshProbes();
  }

  const wallet = new Wallet(privateKey);
  const runTs = Date.now();
  const executionNonce = createBatchExecutionNonce(runTs);
  const testnetAssetMeta = livePost
    ? await resolveTestnetAssetMeta(symbol, fetchFn)
    : { assetIndex: resolveAssetIndexFallback(symbol), szDecimals: 4 };
  const { assetIndex: testnetAssetIndex, szDecimals } = testnetAssetMeta;

  const soilAudit = await resolveRunSoilAudit({
    symbol,
    notionalUsd,
    dryRun,
    livePost,
    abortOnSoilTrip,
    forceLiveSoil,
    skipSoilProbe,
    fetchFn,
  });

  const limitPx = Math.round(soilAudit.probe.midPx);
  const fillsBefore = livePost ? await fetchUserFills(wallet.address, fetchFn) : [];
  const seenFillHashes = seedSeenFillHashes(fillsBefore);

  const systemState = buildSystemState({
    accountBalanceUsd: VERIFY_5TX_ACCOUNT_BALANCE_USD,
    currentCri: 100,
    skipHardlockAssert: true,
  });

  const records = await runVerify5TxOrderLoop(
    {
      wallet,
      symbol,
      notionalUsd,
      soilAudit,
      limitPx,
      livePost,
      dryRun,
      skipSoilProbe,
      fetchFn,
      testnetAssetIndex,
      szDecimals,
      systemState,
      runTs,
      executionNonce,
      seenFillHashes,
    },
    VERIFIED_5TX_ORDER_COUNT,
  );

  return {
    event: "HL_TESTNET_5TX_VERIFY",
    network: "hyperliquid-testnet",
    dryRun,
    livePost,
    wallet: wallet.address,
    timestamp: new Date().toISOString(),
    soilAudit: soilAuditSummary(soilAudit),
    fills: records,
    aggregate: aggregateVerifiedFills(records),
  };
}
