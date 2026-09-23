/**
 * v1.0 Santenmoku SSRC numeric constants — explicit score direction in names.
 *
 * HEALTH_CRI_* / ROOT_DEFENSE_* : 100 → 0 (100 = healthy, 0 = deadlock)
 * RISK_INDEX_*                  : 0 → 100 (0 = nominal, 100 = max risk)
 */

// ── Taiji dual-engine ────────────────────────────────────────────────────────
/** CRI floor for Yang offensive Taiji mode */
export const EQUILIBRIUM_DYNAMIC_CRI_MIN = 75;
/** CRI floor for Yin yield rotation sleeve */
export const EQUILIBRIUM_GUARD_CRI_MIN = 0.01;

/** Root 8 / R1018 — slippage breaker lock label (matrix recalculate + attack path) */
export const R1018_SLIPPAGE_LOCK_LABEL =
  "SOIL TOO LOOSE / SLIPPAGE LIMIT EXCEEDED" as const;
export const ROOT8_SLIPPAGE_LOCK_LABEL = R1018_SLIPPAGE_LOCK_LABEL;

/** Brand-standard Δ glyph for UI copy (LaTeX-style) */
export const BRAND_DELTA_SYMBOL = "$\\Delta$" as const;
/** Plain Δ glyph — mandatory user-facing brand symbol */
export const BRAND_DELTA_GLYPH = "Δ" as const;
/** Top-left HUD primary brand title */
export const BRAND_LIVING_WATER_TITLE = `Be${BRAND_DELTA_GLYPH}LivingWater` as const;
/** Canonical Δ-Neutral product prefix (HUD labels) */
export const BRAND_DELTA_NEUTRAL_LABEL = `${BRAND_DELTA_GLYPH}-Neutral` as const;
export const BRAND_ZERO_DELTA_LABEL = `Zero-${BRAND_DELTA_GLYPH}` as const;
/** Canonical "$\Delta$-Neutral" product prefix */
export const BRAND_DELTA_NEUTRAL = `${BRAND_DELTA_SYMBOL}-Neutral` as const;
/** Best Hedge radar panel title */
export const BRAND_DELTA_NEUTRAL_RADAR_TITLE =
  `BEST HEDGE & ${BRAND_DELTA_SYMBOL}-NEUTRAL RADAR` as const;

// ── Health CRI (SystemState — 100 → 0) ─────────────────────────────────────
export const HEALTH_CRI_MAX = 100;
export const HEALTH_CRI_MIN = 0;
export const HEALTH_CRI_TIER_1_PENALTY = 5;
export const HEALTH_CRI_TIER_2_PENALTY = 12;
export const HEALTH_CRI_TIER_3_PENALTY = 25;
export const HEALTH_CRI_SANTENMOKU_THRESHOLD = 25;
export const HEALTH_CRI_AMBER_THRESHOLD = 50;

/** @deprecated Use HEALTH_CRI_MAX — health score direction (100 = healthy) */
export const CRI_MAX = HEALTH_CRI_MAX;
/** @deprecated Use HEALTH_CRI_MIN */
export const CRI_MIN = HEALTH_CRI_MIN;
/** @deprecated Use HEALTH_CRI_TIER_1_PENALTY */
export const TIER_1_PENALTY = HEALTH_CRI_TIER_1_PENALTY;
/** @deprecated Use HEALTH_CRI_TIER_2_PENALTY */
export const TIER_2_PENALTY = HEALTH_CRI_TIER_2_PENALTY;
/** @deprecated Use HEALTH_CRI_TIER_3_PENALTY */
export const TIER_3_PENALTY = HEALTH_CRI_TIER_3_PENALTY;

// ── Root Defense Matrix (100 → 0) ────────────────────────────────────────────
export const ROOT_DEFENSE_SCORE_MAX = 100;
export const ROOT_DEFENSE_SCORE_MIN = 0;

export const ROOT_DEFENSE_TIER_1_ROOTS = [1, 2, 3, 4, 5] as const;
export const ROOT_DEFENSE_TIER_2_ROOTS = [6, 7, 8, 9, 10] as const;
export const ROOT_DEFENSE_TIER_3_ROOTS = [11, 12, 13, 14, 15] as const;
export const ROOT_DEFENSE_TIER_4_ROOTS = [16, 17, 18, 19, 20] as const;

export const ROOT_DEFENSE_TIER_1_PENALTY = 5;
export const ROOT_DEFENSE_TIER_2_PENALTY = 12;
export const ROOT_DEFENSE_TIER_3_PENALTY = 25;

export const ROOT_DEFENSE_OPTIMAL_MIN = 80;
export const ROOT_DEFENSE_ELEVATED_MIN = 50;

// ── Distance-weighted Risk Index (0 → 100) ────────────────────────────────────
export const RISK_INDEX_MIN = 0;
export const RISK_INDEX_MAX = 100;
export const TOXICITY_ELEVATED_THRESHOLD = 40;
export const TOXIC_MODE_THRESHOLD = 75;
export const TOXIC_MODE_COOLDOWN_MS = 60_000;

export const RISK_INDEX_TIER_DEFINITIONS = [
  { id: "TIER1" as const, roots: [1, 2, 3, 4, 5, 6] as const, weight: 0.2 },
  { id: "TIER2" as const, roots: [7, 8, 9, 10, 11, 12] as const, weight: 0.25 },
  { id: "TIER3" as const, roots: [13, 14, 15, 16, 17, 18] as const, weight: 0.35 },
  { id: "TIER4" as const, roots: [19, 20] as const, weight: 0.2 },
] as const;

/** @deprecated Use RISK_INDEX_TIER_DEFINITIONS */
export const CRI_TIER_DEFINITIONS = RISK_INDEX_TIER_DEFINITIONS;

// ── Hyperliquid endpoints & Pgate ────────────────────────────────────────────
export const HL_EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange" as const;
export const HL_INFO_URL = "https://api.hyperliquid.xyz/info" as const;
export const HL_TESTNET_INFO_URL =
  "https://api.hyperliquid-testnet.xyz/info" as const;
export const HL_TESTNET_EXCHANGE_URL =
  "https://api.hyperliquid-testnet.xyz/exchange" as const;
/** v0.8 RPC failover — soft-fail primary when latency exceeds this (ms) */
export const HL_RPC_FAILOVER_LATENCY_MS = 150 as const;
export const HL_RPC_FAILOVER_TIMEOUT_MS = 3_000 as const;
export const HL_RPC_HEALTH_PROBE_TIMEOUT_MS = 3_000 as const;
/** Backup / public slots (override in deploy for private relays; same host = retry slot) */
export const HL_RPC_BACKUP_INFO_URL = HL_INFO_URL;
export const HL_RPC_PUBLIC_INFO_URL = HL_INFO_URL;
export const HL_RPC_BACKUP_EXCHANGE_URL = HL_EXCHANGE_URL;
export const HL_RPC_PUBLIC_EXCHANGE_URL = HL_EXCHANGE_URL;
/** Pgate.md — max venue ping before blocking new positions (ms) */
export const PGATE_MAX_LATENCY_MS = 200 as const;
/** Pgate.md — max expected slippage before blocking (0.15%) */
export const PGATE_MAX_SLIPPAGE = 0.0015 as const;
export const HL_L2_FETCH_TIMEOUT_MS = 8_000 as const;
export const HL_L2_MAX_RETRIES = 2 as const;
export const HL_L2_PROBE_USD = 10_000;
export const HL_L2_CACHE_TTL_MS = 5_000 as const;
/** Fail-closed soil gate — reject execution when L2 book age exceeds this (ms) */
export const HL_L2_STALE_THRESHOLD_MS = 500 as const;

// ── Solana DEX / Touchwood ───────────────────────────────────────────────────
export const SOLANA_SLOT_LATENCY_MAX_MS = 200 as const;
export const R15_ORACLE_DEVIATION_MAX_BPS = 50 as const;
export const TOUCHWOOD_JUPITER_ORACLE_MAX_BPS = 30 as const;
export const RAYDIUM_TICK_COLLAPSE_MIN_USD = 50_000 as const;
export const SOLANA_BASE_PRIORITY_FEE_LAMPORTS = 5_000 as const;
export const R20_HARDLOCK = "R20_HARDLOCK" as const;

// ── Step 2 weak-target engine ────────────────────────────────────────────────
export const STEP2_HANDSHAKE_TTL_MS = 30_000 as const;
export const MIN_DAY_VOLUME_USD = 5_000_000 as const;
export const FUNDING_ANOMALY_THRESHOLD = 0.0001 as const;
export const FUNDING_EXTREME_THRESHOLD = 0.0005 as const;
export const DEPTH_ASYMMETRY_LOW = 0.35 as const;
export const DEPTH_ASYMMETRY_HIGH = 2.8 as const;
export const LIQUIDATION_MAGNET_PCT = 1.5 as const;
export const TIER2_L2_TOP_N = 10 as const;
export const MAX_TARGETS = 3 as const;

// ── MDD guard HUD scope (grant-audit live ExoMesh TVL envelope) ─────────────
export const MDD_GUARD_WINDOW_DAYS = 90 as const;
export const MDD_GUARD_MONITORED_TVL_USD = 1302.39 as const;
export const MDD_GUARD_SCOPE_NOTE =
  `${MDD_GUARD_WINDOW_DAYS}d window · ~$${(MDD_GUARD_MONITORED_TVL_USD / 1000).toFixed(1)}k monitored ExoMesh TVL` as const;
export const MDD_ZERO_PCT_LABEL = `0.00% MDD (${MDD_GUARD_SCOPE_NOTE})` as const;
export const MDD_DRAWDOWN_GUARD_ACTIVE_LABEL =
  `0.00% Drawdown Guard Active (${MDD_GUARD_SCOPE_NOTE})` as const;
export const MDD_DOWNSIDE_SHIELD_LABEL =
  `0.00% Drawdown Guard Active · Fail-Closed Shielded · ${MDD_GUARD_SCOPE_NOTE}` as const;
