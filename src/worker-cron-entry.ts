import type { Env } from "./env";
import { configureTelegramAlert } from "./services/telemetry/telegram-alert";

/**
 * Isolated cron Worker — GMX↔HL hedge tick (heavy HL signing stack).
 * Deploy separately via wrangler.cron.toml to keep fetch Worker bundle ≤150 KiB gzip.
 */
export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    configureTelegramAlert({
      TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
    });
    if (!env.SRV_200_MAINNET_SESSION_PK?.trim() || !env.SRV_200_MAINNET_USER_ADDRESS?.trim()) {
      return;
    }
    const { runScheduledGmxHedgeCron } = await import("./scheduled-gmx-hedge");
    await runScheduledGmxHedgeCron(env);
  },
} satisfies ExportedHandler<Env>;
