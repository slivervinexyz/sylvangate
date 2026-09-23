import type { Env } from "../env";

export const APP_VERSION = "v1.0 — BeΔ Living Water · Santenmoku (SSRC)";

export const DEFAULT_TOKENS: readonly string[] = [
  "BTC",
  "ETH",
  "SOL",
  "AVAX",
  "LINK",
  "NEAR",
  "DOT",
  "ARB",
  "ADA",
] as const;

/** Default bilateral friction rate used when assembling matrix rows */
export const DEFAULT_FRICTION = 0.0012;

/** Default fixed USD cost per open/close round-trip */
export const DEFAULT_FIXED_COST_USD = 2.5;

/** Minimum cross-exchange annualized APR (%) to emit a strategy label */
export const STRATEGY_APR_THRESHOLD = 5;

/** Placeholder volatility until a live VIX/DVOL feed is wired */
export const DEFAULT_VIX = 16.8;
export const DEFAULT_DVOL = 52.5;

const DEFAULT_GATEWAY_URL =
  "https://javier-quant-unified-suite.onrender.com/matrix";

export interface RuntimeConfig {
  version: string;
  telemetryHealthPath: string;
  pythonGatewayUrl: string;
  usePythonGateway: boolean;
  defaultTokens: readonly string[];
}

export function resolveConfig(_env: Env): RuntimeConfig {
  return {
    version: APP_VERSION,
    telemetryHealthPath: "/api/telemetry/health",
    pythonGatewayUrl: _env.PYTHON_GATEWAY_URL ?? DEFAULT_GATEWAY_URL,
    usePythonGateway: _env.USE_PYTHON_GATEWAY === "true",
    defaultTokens: DEFAULT_TOKENS,
  };
}

export function hktTimestamp(): string {
  return new Date().toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" });
}

export const CORS_JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};
