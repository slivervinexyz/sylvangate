/**
 * Cloudflare Workers environment bindings for slivervine-app.
 * Runtime telemetry persists to SLIVERVINE_KV (native KV binding).
 */
export interface Env {
  /** Optional Python multi-exchange gateway */
  PYTHON_GATEWAY_URL?: string;
  /** "true" | "false" — prefer native fetch when false */
  USE_PYTHON_GATEWAY?: string;
  /** Static assets (public/) — brand images etc. */
  ASSETS?: Fetcher;
  /** Isolated BeΔ Water KV (wrangler.toml SSOT) */
  BEDELTA_WATER_KV?: KVNamespace;
  /** Compat alias — same namespace as BEDELTA_WATER_KV */
  SLIVERVINE_KV?: KVNamespace;
  /** Alias binding — same namespace as BEDELTA_WATER_KV (system:state SSOT) */
  SYSTEM_STATE_KV?: KVNamespace;
  /** Layout-metric unlock padding — inject via wrangler secret put (never commit) */
  VIEWPORT_PADDING_OFFSET?: string;
  /** Session entropy seed — arms authenticated RPC circuit probes */
  SESSION_ENTROPY_SEED?: string;
  /** Environment entropy seed alias */
  ENV_ENTROPY_SEED?: string;
  /** @deprecated Use SESSION_ENTROPY_SEED */
  LEGACY_INTEGRITY_PADDING?: string;
  /** @deprecated Use ENV_ENTROPY_SEED */
  LEGACY_XUANWU_PADDING?: string;
  OWNER_IDENTITY?: string;
  JAVIER_SIGNATURE?: string;
  /** Public HUD canary for /api/hud-stream handshake (also Vite build var) */
  NEXT_PUBLIC_HUD_CANARY?: string;
  /** Strike alpha — inject via Wrangler vars (see docs/01_architecture_and_standards/01_core_specs/01_SYSTEM_TOPOLOGY_AND_YELLOW_PAPER.md) */
  STRIKE_IMBALANCE_RATIO_MIN?: string;
  STRIKE_MICRO_SPREAD_COLLAPSE_BPS?: string;
  STRIKE_SENSING_PROBE_USD?: string;
  STRIKE_SENSING_COOLDOWN_MS?: string;
  STRIKE_PITSTOP_FUNDING_BPS?: string;
  STRIKE_PITSTOP_MAX_HOLD_MS?: string;
  STRIKE_FLEET_MODE?: string;
  /** Coach alpha — inject via Wrangler vars (see docs/01_architecture_and_standards/01_core_specs/01_SYSTEM_TOPOLOGY_AND_YELLOW_PAPER.md) */
  COACH_VIX_SPIKE_THRESHOLD?: string;
  COACH_DVOL_SPIKE_THRESHOLD?: string;
  COACH_VENUE_DELAY_MS?: string;
  COACH_MARGIN_SUBSTITUTION_PCT?: string;
  COACH_MIN_EDGE_BPS?: string;
  COACH_FLEET_DAILY_LOSS_MULTIPLIER?: string;
  /** "true" — append pop-culture tacticalAlias to structured log details */
  TACTICAL_LOG_METAPHORS?: string;
  /** Telegram Bot API token for panic alerts */
  TELEGRAM_BOT_TOKEN?: string;
  /** Telegram chat id for panic alerts */
  TELEGRAM_CHAT_ID?: string;
  /** 7-day mainnet execution / probe logs (Edge KV) */
  EXECUTION_LOGS_KV?: KVNamespace;
  /** Mainnet session agent key — wrangler secret put (never commit) */
  HYPERLIQUID_MAINNET_SESSION_PK?: string;
  /** Mainnet master wallet address — wrangler secret put */
  HYPERLIQUID_MAINNET_USER_ADDRESS?: string;
  /** Arbitrum GMX v2 user address — wrangler secret put */
  ARB_MAINNET_USER_ADDRESS?: string;
  /** Deployed SliverVineRiskOracle — AA UserOp fail-closed read SSOT */
  SLIVERVINE_RISK_ORACLE_ADDRESS?: string;
  /** @deprecated Use SLIVERVINE_RISK_ORACLE_ADDRESS */
  SILVERVINE_RISK_ORACLE_ADDRESS?: string;
  /** Arbitrum session key — empty = read-only GM telemetry (no signing) */
  ARB_MAINNET_SESSION_PK?: string;
  /** SRV-200 Wallet B session key — HL auto-hedge for GMX GM */
  SRV_200_MAINNET_SESSION_PK?: string;
  /** SRV-200 Wallet B master address (GMX + HL margin) */
  SRV_200_MAINNET_USER_ADDRESS?: string;
  /** "true" — mainnet live signing */
  IS_MAINNET?: string;
  /** GMX v2 ui fee receiver — SliverVine Treasury (wrangler var) */
  GMX_UI_FEE_RECEIVER?: string;
  /** QuickNode Arbitrum WSS — GMX v2 event stream + sequencer heartbeats */
  ARBITRUM_WSS_URL?: string;
  /** Robinhood / R-Chain WSS placeholder */
  ROBINHOOD_WSS_URL?: string;
  /** Hyperliquid WSS override (defaults to canonical mainnet HL WS) */
  HYPERLIQUID_WSS_URL?: string;
}

export {
  DEFAULT_ARB_MAINNET_USER_ADDRESS,
  DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS,
  DEFAULT_SRV_200_MAINNET_USER_ADDRESS,
  resolveDualWalletEnv,
  resolveGrantAuditEnv,
} from "./env-grant-defaults";
