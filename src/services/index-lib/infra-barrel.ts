export {
  KV_KEYS,
  KV_TTL_SECONDS,
  saveSystemStateToKV,
  saveMatrixPayloadToKV,
  saveMarketSnapshotToKV,
  saveSoakTelemetryToKV,
  appendRiskLogToKV,
  readSystemStateFromKV,
  type KvWriteResult,
  type SystemStateKvRecord,
  type RiskLogEntry,
  type RiskLogRollingRecord,
  type SliverVineKv,
} from "../kv-store";

export {
  extractCriticalKvFlags,
  shouldPersistSystemStateToKv,
  shouldPersistMatrixPayloadToKv,
  type CriticalKvFlags,
} from "../stateManager";

export {
  sendPanicAlert,
  formatPanicAlertMessage,
  configureTelegramAlert,
  type PanicMetrics,
  type TelegramEnv,
  type SendPanicAlertResult,
} from "../telegram-notifier";

export {
  sendPanicAlert as sendPanicAlertReason,
  notifyFailClosedLock,
} from "../telemetry/telegram-alert";

export {
  RECOVERY_COOLDOWN_MS,
  NORMALIZED_SPREAD_MAX,
  recordSoilViolation,
  recordSpreadSample,
  isSoftR20Deadlock,
  vineMeshAutoRecovery,
  checkCircuitRecovery,
  getVineMeshRecoveryCount,
  type VineMeshRecoveryResult,
  type CircuitRecoveryResult,
} from "../circuit-breaker";

export {
  SOAK_TELEMETRY_KV_KEY,
  SOAK_ROLLING_MAX_TICKS,
  SOAK_TELEMETRY_COINS,
  runSoakTelemetryTick,
  evaluateSoakCoinTick,
  appendSoakTicks,
  readInMemorySoakLog,
  type SoakTelemetryTick,
  type SoakTelemetryRollingLog,
  type RunSoakTelemetryTickOptions,
} from "../soak-telemetry";
