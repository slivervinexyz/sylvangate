import type { Env } from "./env";
import { configureTelegramAlert } from "./services/telemetry/telegram-alert";
import { runSoakTelemetryTick } from "./services/soak-telemetry";
import {
  bootstrapIntentPersistence,
  createKvIntentPersistenceStore,
  syncLedgerToPersistence,
} from "./core/intent-persistence";
import { configureFlattenHardlockKv } from "./core/intent-ledger/flatten-hardlock";
import { configureUnlockReauthorizationKv } from "./services/session-key-adapter-lib/unlock-reauthorization-kv";
import { runMainnetMonitorTick } from "./services/mainnet-monitor";
import { refreshGrantAuditPayloadCache } from "./routes/grant-audit-lib/grant-audit-precache";

async function runScheduledSoakTelemetry(env: Env): Promise<void> {
  await runSoakTelemetryTick({ kv: env.SLIVERVINE_KV });
}

let intentPersistenceBootPromise: Promise<void> | null = null;
let intentPersistenceBootUnavailable = false;

/** Restore 2PC ledger from KV and emergency-unwind expired PREPARED intents */
export async function ensureIntentPersistenceBoot(env: Env): Promise<void> {
  configureTelegramAlert({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  if (intentPersistenceBootUnavailable) return;
  const kv = env.SLIVERVINE_KV ?? env.SYSTEM_STATE_KV;
  configureFlattenHardlockKv(kv);
  configureUnlockReauthorizationKv(kv);
  if (!kv) return;

  if (!intentPersistenceBootPromise) {
    intentPersistenceBootPromise = (async () => {
      try {
        const store = createKvIntentPersistenceStore(kv);
        const result = await bootstrapIntentPersistence(store);
        console.log(
          "[bedelta] intent persistence boot",
          JSON.stringify({
            restoredCount: result.restoredCount,
            unwound: result.unwound.length,
          }),
        );
      } catch (err) {
        intentPersistenceBootUnavailable = true;
        console.warn(
          "[bedelta] intent persistence boot skipped — KV unavailable in local dev",
          err instanceof Error ? err.message : err,
        );
      }
    })();
  }

  await intentPersistenceBootPromise;
}

export async function runScheduledJobs(
  env: Env,
  cron = "0 * * * *",
): Promise<void> {
  configureTelegramAlert({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  await ensureIntentPersistenceBoot(env);
  await runScheduledSoakTelemetry(env);
  const kv = env.SLIVERVINE_KV ?? env.SYSTEM_STATE_KV;
  if (kv) {
    await syncLedgerToPersistence(createKvIntentPersistenceStore(kv));
  }

  if (
    env.EXECUTION_LOGS_KV &&
    env.HYPERLIQUID_MAINNET_USER_ADDRESS?.trim()
  ) {
    await runMainnetMonitorTick(
      {
        EXECUTION_LOGS_KV: env.EXECUTION_LOGS_KV,
        HYPERLIQUID_MAINNET_USER_ADDRESS: env.HYPERLIQUID_MAINNET_USER_ADDRESS,
        HYPERLIQUID_MAINNET_SESSION_PK: env.HYPERLIQUID_MAINNET_SESSION_PK,
      },
      cron,
    );
    try {
      await refreshGrantAuditPayloadCache(env);
    } catch (err) {
      console.warn(
        "[bedelta] grant audit KV precompute failed",
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.warn(
      "[bedelta] mainnet monitor skipped — EXECUTION_LOGS_KV or USER_ADDRESS secret missing",
    );
  }

  if (env.SRV_200_MAINNET_SESSION_PK?.trim() && env.SRV_200_MAINNET_USER_ADDRESS?.trim()) {
    // GMX↔HL hedge cron runs on isolated worker — src/worker-cron-entry.ts (wrangler.cron.toml).
  }
}
