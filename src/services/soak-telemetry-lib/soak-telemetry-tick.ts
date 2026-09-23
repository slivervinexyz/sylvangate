/**
 * 24/7 sandbox soak telemetry — per-coin evaluation and cron tick.
 */

import { buildSystemState, type CoreSystemState } from "../../core/state";
import { checkSoilResistance } from "../../core/risk";
import {
  auditLiveBookSoilResistance,
  buildSoilInputFromLiveBook,
  type LiveBookSoilProbe,
} from "../check-soil-resistance";
import {
  computeLiveBookMetrics,
  fetchLiveL2Book,
} from "../exchanges/hl-l2-book";
import { recordSoilViolation, recordSpreadSample } from "../circuit-breaker";
import { recordTelemetryProbe } from "../telemetry-analytics-lib/telemetry-analytics-core";
import {
  SOAK_TELEMETRY_COINS,
  type RunSoakTelemetryTickOptions,
  type SoakTelemetryRollingLog,
  type SoakTelemetryTick,
} from "./soak-telemetry-types";
import {
  appendSoakTicks,
  loadRollingLog,
  persistRollingLog,
} from "./soak-telemetry-rolling";

function defaultSystemState(): CoreSystemState {
  return {
    ...buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    }),
    isHedgeActive: false,
  };
}

/** Evaluate one coin against live testnet L2 + soil + counter-attack gates. */
export async function evaluateSoakCoinTick(
  coin: string,
  state: CoreSystemState,
  options: RunSoakTelemetryTickOptions = {},
): Promise<SoakTelemetryTick> {
  recordTelemetryProbe();
  const started = (options.now ?? Date.now)();
  const at = new Date(started).toISOString();

  try {
    const snapshot = await fetchLiveL2Book(coin, {
      fetchFn: options.fetchFn,
      maxRetries: options.fetchOptions?.maxRetries ?? 1,
      timeoutMs: options.fetchOptions?.timeoutMs,
    });

    const metrics = computeLiveBookMetrics(snapshot.book);
    if (!metrics) {
      return {
        at,
        coin: coin.toUpperCase(),
        latencyMs: (options.now ?? Date.now)() - started,
        soilOk: false,
        soilReasons: ["EMPTY_L2_BOOK"],
        crossVenueSlippage: -1,
        spotPerpSlippage: -1,
        counterVerdict: "REJECT",
        counterArmed: false,
        imbalanceRatio: 0,
        liveSlippageBps: Number.POSITIVE_INFINITY,
        dynamicMaxSlUsd: state.dynamicMaxSL,
        error: "EMPTY_L2_BOOK",
      };
    }

    const liveProbe: LiveBookSoilProbe = {
      symbol: coin.toUpperCase(),
      bestBid: metrics.bestBid,
      bestAsk: metrics.bestAsk,
      midPx: metrics.midPx,
      bidDepthUsd: metrics.bidDepthUsd,
      askDepthUsd: metrics.askDepthUsd,
      spreadBps: metrics.spreadBps,
      priceImpactBps: metrics.priceImpactBps,
      depthUsd: metrics.depthUsd,
    };

    const soilBase = checkSoilResistance(buildSoilInputFromLiveBook(liveProbe));
    const soilAudit = auditLiveBookSoilResistance(liveProbe);

    recordSpreadSample(metrics.spreadBps / 10_000);
    if (soilAudit.tripped) {
      recordSoilViolation(started);
    }

    const counter = {
      verdict: soilBase.ok && soilAudit.ok ? "STANDBY" : "REJECT",
      armed: false,
      imbalanceRatio: 0,
      liveSlippageBps: metrics.priceImpactBps,
      dynamicMaxSlUsd: state.dynamicMaxSL,
    };

    return {
      at,
      coin: coin.toUpperCase(),
      latencyMs: (options.now ?? Date.now)() - started,
      soilOk: soilBase.ok && soilAudit.ok,
      soilReasons: [...new Set([...soilBase.reasons, ...soilAudit.reasons])],
      crossVenueSlippage: soilBase.crossVenueSlippage,
      spotPerpSlippage: soilBase.spotPerpSlippage,
      counterVerdict: counter.verdict,
      counterArmed: counter.armed,
      imbalanceRatio: counter.imbalanceRatio,
      liveSlippageBps: counter.liveSlippageBps,
      dynamicMaxSlUsd: counter.dynamicMaxSlUsd,
    };
  } catch (err) {
    return {
      at,
      coin: coin.toUpperCase(),
      latencyMs: (options.now ?? Date.now)() - started,
      soilOk: false,
      soilReasons: ["TICK_EXCEPTION"],
      crossVenueSlippage: -1,
      spotPerpSlippage: -1,
      counterVerdict: "REJECT",
      counterArmed: false,
      imbalanceRatio: 0,
      liveSlippageBps: Number.POSITIVE_INFINITY,
      dynamicMaxSlUsd: state.dynamicMaxSL,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Run one 1-minute cron-equivalent soak telemetry tick (ETH/USD). */
export async function runSoakTelemetryTick(
  options: RunSoakTelemetryTickOptions = {},
): Promise<SoakTelemetryRollingLog> {
  const state = options.systemState ?? defaultSystemState();
  const coins = options.coins ?? SOAK_TELEMETRY_COINS;
  const ticks: SoakTelemetryTick[] = [];

  for (const coin of coins) {
    ticks.push(await evaluateSoakCoinTick(coin, state, options));
  }

  const current = await loadRollingLog(options.kv);
  const next = appendSoakTicks(current, ticks);
  await persistRollingLog(next, options.kv);

  console.log(
    JSON.stringify({
      level: "info",
      module: "soak-telemetry",
      event: "SOAK_TICK",
      tickCount: next.tickCount,
      bufferSize: next.ticks.length,
      lastUpdated: next.lastUpdated,
      coins: ticks.map((t) => ({
        coin: t.coin,
        soilOk: t.soilOk,
        counterVerdict: t.counterVerdict,
        latencyMs: t.latencyMs,
        error: t.error ?? null,
      })),
    }),
  );

  return next;
}
