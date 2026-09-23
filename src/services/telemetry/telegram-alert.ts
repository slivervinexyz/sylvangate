/**
 * Fail-Closed Telegram alerting — pure fetch Bot Webhook (Edge-safe).
 * Instant dispatch when soil / rootProtection severs the hot-key pipeline.
 */

export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface SendPanicAlertResult {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  message?: string;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

let configuredEnv: TelegramEnv = {};

/** Bind Worker secrets / .env.production credentials into the alert bus. */
export function configureTelegramAlert(env: TelegramEnv): void {
  configuredEnv = {
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN?.trim() || configuredEnv.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID?.trim() || configuredEnv.TELEGRAM_CHAT_ID,
  };
}

function resolveEnv(override?: TelegramEnv): TelegramEnv {
  const fromProcess =
    typeof process !== "undefined"
      ? {
          TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
          TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
        }
      : {};
  return {
    TELEGRAM_BOT_TOKEN:
      override?.TELEGRAM_BOT_TOKEN?.trim() ||
      configuredEnv.TELEGRAM_BOT_TOKEN?.trim() ||
      fromProcess.TELEGRAM_BOT_TOKEN?.trim(),
    TELEGRAM_CHAT_ID:
      override?.TELEGRAM_CHAT_ID?.trim() ||
      configuredEnv.TELEGRAM_CHAT_ID?.trim() ||
      fromProcess.TELEGRAM_CHAT_ID?.trim(),
  };
}

/**
 * Fail-closed panic webhook — posts `reason` via Telegram Bot API.
 * Missing credentials → skipped (never throws into the hot path).
 */
export async function sendPanicAlert(
  reason: string,
  options: { env?: TelegramEnv; fetchFn?: typeof fetch } = {},
): Promise<SendPanicAlertResult> {
  const env = resolveEnv(options.env);
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      sent: false,
      skipped: true,
      reason: "TELEGRAM_CREDENTIALS_MISSING",
    };
  }

  const message = [
    "🚨 BeΔ FAIL-CLOSED LOCK",
    `Worker: bedelta-living-water`,
    `Reason: ${reason}`,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");

  const fetchFn = options.fetchFn ?? fetch;
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return {
        sent: false,
        skipped: false,
        reason: `TELEGRAM_HTTP_${res.status}`,
        message,
      };
    }

    return { sent: true, skipped: false, message };
  } catch (err) {
    return {
      sent: false,
      skipped: false,
      reason: err instanceof Error ? err.message : String(err),
      message,
    };
  }
}

/**
 * Sync fire-and-forget for soil / rootProtection hot paths.
 * Never blocks or throws into the circuit-breaker call stack.
 */
export function notifyFailClosedLock(reason: string): void {
  void sendPanicAlert(reason).catch((err) => {
    console.error(
      "[telegram-alert] fail-closed notify error",
      err instanceof Error ? err.message : err,
    );
  });
}

/** @internal test reset */
export function __resetTelegramAlertForTests(): void {
  configuredEnv = {};
}
