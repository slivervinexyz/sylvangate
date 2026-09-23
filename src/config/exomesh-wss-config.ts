/**
 * ExoMesh venue WSS schema — GMX v2 event stream · sequencer heartbeats · venue placeholders.
 * SSOT for real-time Arbitrum / cross-venue WebSocket endpoints.
 */

import type { Env } from "../env";
import { HL_WS_URL } from "../adapters/hl/websocket/types";

/** Public Arbitrum One WS fallback when ARBITRUM_WSS_URL is unset (local / CI). */
export const ARBITRUM_WSS_PUBLIC_FALLBACK =
  "wss://arb1.arbitrum.io/ws" as const;

export interface ExoMeshWssEnv {
  ARBITRUM_WSS_URL?: string;
  ROBINHOOD_WSS_URL?: string;
  HYPERLIQUID_WSS_URL?: string;
}

export interface ExoMeshWssConfig {
  /** QuickNode (or fallback) Arbitrum WSS — GMX v2 logs + sequencer newHeads */
  arbitrumWssUrl: string;
  /** Robinhood / R-Chain WSS — optional until venue live */
  robinhoodWssUrl: string | null;
  /** Hyperliquid WSS — defaults to canonical mainnet HL endpoint */
  hyperliquidWssUrl: string;
}

type EnvBag = ExoMeshWssEnv | Env | Record<string, string | undefined>;

function readEnvBag(env?: EnvBag): EnvBag {
  if (env) return env;
  return typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {};
}

function trimOrNull(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Resolve ExoMesh WSS endpoints from Workers Env / process.env. */
export function resolveExomeshWssConfig(env?: EnvBag): ExoMeshWssConfig {
  const e = readEnvBag(env);
  return {
    arbitrumWssUrl:
      trimOrNull(e.ARBITRUM_WSS_URL) ?? ARBITRUM_WSS_PUBLIC_FALLBACK,
    robinhoodWssUrl: trimOrNull(e.ROBINHOOD_WSS_URL),
    hyperliquidWssUrl: trimOrNull(e.HYPERLIQUID_WSS_URL) ?? HL_WS_URL,
  };
}

/** Real-time GMX v2 event streaming (eth_subscribe logs / heads) on Arbitrum. */
export function resolveGmxV2EventStreamWssUrl(env?: EnvBag): string {
  return resolveExomeshWssConfig(env).arbitrumWssUrl;
}

/** Sequencer heartbeat channel — same Arbitrum WSS (newHeads / uptime probes). */
export function resolveSequencerHeartbeatWssUrl(env?: EnvBag): string {
  return resolveExomeshWssConfig(env).arbitrumWssUrl;
}

export function resolveArbitrumWssUrl(env?: EnvBag): string {
  return resolveExomeshWssConfig(env).arbitrumWssUrl;
}

export function resolveRobinhoodWssUrl(env?: EnvBag): string | null {
  return resolveExomeshWssConfig(env).robinhoodWssUrl;
}

export function resolveHyperliquidWssUrl(env?: EnvBag): string {
  return resolveExomeshWssConfig(env).hyperliquidWssUrl;
}
