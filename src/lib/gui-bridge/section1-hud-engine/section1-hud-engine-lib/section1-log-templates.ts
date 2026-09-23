import { loadVerified5TxResults, computeVerified5TxSha256Anchor } from "../../../../data/verified-5tx";
import { truncateSessionKeyWallet } from "../../../../data/verified-5tx-display-helpers";
import type { TerminalLogLevel } from "../../terminal-log";
import {
  formatBatchDropdownLabel,
  formatLive5TxFillLog,
  formatTxHashForLog,
  truncateTxHash,
} from "../../section1-hud-log-formatters";
import { MEV_RECOVERY_SAVED_BPS, type SoilResistanceLogEntry, type TxBatchRecord } from "../section1-hud-types";
import type { OperatorUnlockVersion } from "../../../../data/operator-matrix";
import { formatSoilTelemetryTerminalLine } from "../../../../services/risk-control";

const LOG_TEMPLATE = (level: TerminalLogLevel, message: string) => ({
  level,
  message,
});

export function buildAutoDemoLogTemplates(): readonly {
  level: TerminalLogLevel;
  message: string;
}[] {
  const results = loadVerified5TxResults();
  return [
    LOG_TEMPLATE("INFO", "AUTO_DEMO: Twin-Engine read-only playback started (no wallet)"),
    ...results.fills.map((fill, i) =>
      LOG_TEMPLATE(
        "INFO",
        `DEMO_FILL ${i + 1}/5 | ${fill.side} ${fill.symbol} $${fill.notionalUsd} | hash=${truncateTxHash(fill.txHash)} | saved=${fill.savedUsd.toFixed(4)} USDC`,
      ),
    ),
    LOG_TEMPLATE("SYSTEM", "SHIELD_GLOW: Santenmoku intercept animation complete · 5/5 verified"),
  ];
}

export function buildLiveFillLogTemplate(
  index: number,
  _side: string,
  txHash: string,
  latencyMs = 13,
): { level: TerminalLogLevel; message: string } {
  return LOG_TEMPLATE("SUCCESS", formatLive5TxFillLog(index, txHash, latencyMs));
}

export function buildMevAttackLogTemplates(
  soilLog: SoilResistanceLogEntry,
  protocolVersion: OperatorUnlockVersion,
  toxicityBps: number,
): readonly { level: TerminalLogLevel; message: string }[] {
  const soilLine =
    formatSoilTelemetryTerminalLine(
      "ETH",
      { tripped: soilLog.tripped, reasons: soilLog.reasons },
      155_000,
    ) ??
    `SOIL_RESISTANCE_PROBE: ${soilLog.tripped ? "REJECTED" : "PASS"} | symbol: ETH`;
  return [
    LOG_TEMPLATE("SIMULATION", "MEV_ATTACK_ACTIVE: toxicity injected into live shield model"),
    LOG_TEMPLATE(
      protocolVersion === "v1.5" ? "SIMULATION" : "EMERGENCY",
      protocolVersion === "v1.5"
        ? `[UM-03 INVERT] ${toxicityBps.toFixed(1)} bps Toxicity intercepted and converted to Dynamic Protocol Rebate (+${toxicityBps.toFixed(1)} bps)`
        : `[CRITICAL] MEV Sandwich Succeeded! Slippage Loss: -${toxicityBps.toFixed(1)} bps`,
    ),
    LOG_TEMPLATE(soilLog.tripped ? "WARN" : "INFO", soilLine),
    LOG_TEMPLATE(
      "SIMULATION",
      protocolVersion === "v1.5"
        ? `[ REBATE CAPTURED ] +${MEV_RECOVERY_SAVED_BPS.toFixed(2)} bps saved · Ultra-Vibrant Neon Purple engaged`
        : `[ DAMAGED / UNPROTECTED ] Saved Amount degraded by -${toxicityBps.toFixed(1)} bps`,
    ),
  ];
}

export function buildBatchConsoleHydrationLogs(batch: TxBatchRecord): readonly {
  level: TerminalLogLevel;
  message: string;
}[] {
  const anchor = computeVerified5TxSha256Anchor(batch.results.fills);
  return [
    LOG_TEMPLATE("INFO", `BATCH_HISTORY: loaded ${formatBatchDropdownLabel(batch)}`),
    LOG_TEMPLATE("INFO", `TCA_ANCHOR: SHA-256 ${anchor}`),
    LOG_TEMPLATE(
      "SYSTEM",
      `VERIFICATION_ANCHOR: ${batch.results.fills.length}/5 fills · wallet ${truncateSessionKeyWallet(batch.results.wallet)}`,
    ),
    ...batch.results.fills.map((fill, i) =>
      LOG_TEMPLATE(
        "INFO",
        `BATCH_FILL ${i + 1}/5 | ${fill.side} ${fill.symbol} | TxHash: ${formatTxHashForLog(fill.txHash)} | ${fill.gatedSlippageBps} bps gated`,
      ),
    ),
  ];
}

/** @deprecated Use buildBatchConsoleHydrationLogs */
export function buildBatchSwitchLogTemplates(batch: TxBatchRecord): readonly {
  level: TerminalLogLevel;
  message: string;
}[] {
  return buildBatchConsoleHydrationLogs(batch);
}
