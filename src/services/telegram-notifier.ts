/**
 * Telegram panic alerting — metrics formatter + fail-closed reason webhook.
 * @see telemetry/telegram-alert.ts — SSOT sendPanicAlert(reason)
 */

import {
  sendPanicAlert as sendPanicAlertReason,
  configureTelegramAlert,
  type TelegramEnv,
  type SendPanicAlertResult,
} from "./telemetry/telegram-alert";

export type { TelegramEnv, SendPanicAlertResult };
export { configureTelegramAlert };

export interface PanicMetrics {
  coin: string;
  imbalanceRatio: number;
  liveSlippageBps: number;
  dynamicMaxSlUsd: number;
  verdict?: string;
  limitPx?: string | null;
}

export interface SendPanicAlertOptions {
  env?: TelegramEnv;
  fetchFn?: typeof fetch;
}

/** Format counter-attack execution log for Telegram dispatch. */
export function formatPanicAlertMessage(metrics: PanicMetrics): string {
  const imbalancePct = (metrics.imbalanceRatio * 100).toFixed(2);
  const slippagePct = (metrics.liveSlippageBps / 100).toFixed(3);
  const lines = [
    "🚨 Santenmoku Counter-Attack Alert",
    `Coin: ${metrics.coin}`,
    `Imbalance: ${imbalancePct}%`,
    `Live Slippage: ${slippagePct}%`,
    `Dynamic Max SL: $${metrics.dynamicMaxSlUsd.toFixed(2)}`,
  ];

  if (metrics.verdict) {
    lines.push(`Verdict: ${metrics.verdict}`);
  }
  if (metrics.limitPx) {
    lines.push(`Passive Limit: ${metrics.limitPx}`);
  }

  return lines.join("\n");
}

/**
 * Dispatch panic metrics via Telegram Bot API when credentials exist.
 * Delegates HTTP to fail-closed `sendPanicAlert(reason)` SSOT.
 */
export async function sendPanicAlert(
  metrics: PanicMetrics,
  options: SendPanicAlertOptions = {},
): Promise<SendPanicAlertResult> {
  return sendPanicAlertReason(formatPanicAlertMessage(metrics), options);
}

export { sendPanicAlertReason };
