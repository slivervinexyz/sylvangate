import { buildTargetPairTerminalLogTemplates } from "../../services/risk-control";
import { unwrapHlError } from "../../adapters/hl/error-unwrap";

export type TerminalLogLevel =
  | "INFO"
  | "SUCCESS"
  | "ERROR"
  | "WARN"
  | "SIMULATION"
  | "EMERGENCY"
  | "SYSTEM";

export function unwrapErrorDetail(err: unknown): string {
  return unwrapHlError(err);
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_REAUTH_MS = SESSION_TTL_MS - 1_000;

export interface TerminalLogLine {
  id: string;
  timestamp: string;
  level: TerminalLogLevel;
  message: string;
}

function formatLogTime(date = new Date()): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

export function createTerminalLog(
  level: TerminalLogLevel,
  message: string,
  timestamp = formatLogTime(),
): TerminalLogLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    level,
    message,
  };
}

export const BASE_TERMINAL_LOG_TEMPLATES = buildTargetPairTerminalLogTemplates();

export const MEV_SIMULATION_LOGS: readonly {
  level: TerminalLogLevel;
  message: string;
}[] = [
  {
    level: "SIMULATION",
    message: "MEV_ATTACK_DETECTED: Sandwich vector identified on Cross-DEX book",
  },
  {
    level: "SIMULATION",
    message: "SANTENMOKU_CIRCUIT_TRIPPED: R1-R6 Soil Shield Engaged",
  },
  {
    level: "SIMULATION",
    message: "EXECUTION_PROTECTED: 100% Intercepted (0.00ms latency impact)",
  },
];

export const EMERGENCY_REVOKE_LOGS: readonly {
  level: TerminalLogLevel;
  message: string;
}[] = [
  {
    level: "EMERGENCY",
    message: "HOTKEY_PANIC_KILLSWITCH_ACTIVATED: Session key revoked by user",
  },
  {
    level: "EMERGENCY",
    message: "EIP712_SIGNING_PIPELINE: PHYSICALLY_SEVERED",
  },
  {
    level: "SYSTEM",
    message: "SystemState posture changed to READ_ONLY_LOCKOUT",
  },
];

export const SESSION_KEY_REAUTH_LOG =
  "SESSION_KEY_REAUTHORIZED: EIP-712 pipeline restored for 24h" as const;

export const R17_CIRCUIT_BREAKER_SEVER_LOGS: readonly {
  level: TerminalLogLevel;
  message: string;
}[] = [
  {
    level: "EMERGENCY",
    message:
      "[CRITICAL] PHYSICAL_DEADLOCK_TRIGGERED: EIP-712 Signature Pipe Severed",
  },
];

export const R20_CIRCUIT_BREAKER_SEVER_LOGS: readonly {
  level: TerminalLogLevel;
  message: string;
}[] = R17_CIRCUIT_BREAKER_SEVER_LOGS;

export const TERMINAL_LEVEL_CLASS: Record<TerminalLogLevel, string> = {
  INFO: "text-emerald-400/90",
  SUCCESS: "text-emerald-300 font-semibold",
  ERROR: "text-red-400 font-semibold",
  WARN: "text-amber-400/90",
  SIMULATION: "text-sky-300",
  EMERGENCY: "text-red-400 font-semibold",
  SYSTEM: "text-red-300/90",
};
