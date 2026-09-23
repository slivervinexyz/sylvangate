/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 *
 * Status dictionary — 20-Root telemetry tiers, tips, and labels.
 */

import { BRAND_DELTA_SYMBOL } from "../constants";

const brandDelta = BRAND_DELTA_SYMBOL;

export const STATUS_DICTIONARY_TELEMETRY = {
  /** 20-Root Telemetry — Tier 1–4 pipeline lifecycle groups (Demo Control Hub) */
  ROOT_TELEMETRY_TIERS: {
    TIER1: {
      id: "TIER1",
      badge: "TIER 1",
      emoji: "🛡️",
      title: "TIER 1: STEP 1 - MACRO / GEO PRE-TRADE LOCKS",
      header: "TIER 1: STEP 1 - MACRO / GEO LOCKS",
      focus:
        "Pre-trade physical locks, macro volatility fuses, and geo/session gates",
      roots: [1, 2, 3, 4, 5, 6],
      accent: "emerald",
    },
    TIER2: {
      id: "TIER2",
      badge: "TIER 2",
      emoji: "🎯",
      title: "TIER 2: STEP 2 - TARGET / FUNDING / BASIS SHIELD",
      header: "TIER 2: STEP 2 - TARGET / FUNDING / BASIS",
      focus:
        `${brandDelta}-neutral target selection, yield discrepancy, and settlement locks`,
      roots: [7, 8, 9, 10, 11, 12],
      accent: "cyan",
    },
    TIER3: {
      id: "TIER3",
      badge: "TIER 3",
      emoji: "⚡",
      title: "TIER 3: STEP 3 - EXECUTION / SLIPPAGE / MAX SL",
      header: "TIER 3: STEP 3 - EXECUTION & SLIPPAGE",
      focus:
        "Execution path, slippage breakers, Max SL weld, and dispatch locks",
      roots: [13, 14, 15, 16, 17, 18],
      accent: "yellow",
    },
    TIER4: {
      id: "TIER4",
      badge: "TIER 4",
      emoji: "📊",
      title: "TIER 4: STEP 4 - HKT SETTLEMENT & HARD DEADLOCK",
      header: "TIER 4: STEP 4 - SETTLEMENT & HARD DEADLOCK",
      focus: "HKT settlement gates, ClOID live audit, and hard deadlock closure",
      roots: [19, 20],
      accent: "cyan",
    },
  },

  /** 20-Root Telemetry algorithm tooltips (Demo Control Hub) */
  ROOT_TELEMETRY_TIPS: {
    1: "Dynamic Max SL ceiling = (Account Equity × 1%) + $100 USD regardless of leverage/size.",
    2: "Automated IP and regional compliance barrier check.",
    3: "Liquidity depth-to-impact calculation to prevent thin-order slippage.",
    4: "Detects orderbook candle spikes near hourly candles to block bad fills.",
    5: "Monitors macro volatility indicators (VIX/DVOL) to circuit-break high-risk market entries.",
    6: "Role-based authorization gate (Shield / Tactical / Flash) tied to HL Wallet TX history.",
    7: "Auto-calibrates position leverage based on the dynamic Effective Max SL boundary.",
    8: "Physical slippage circuit breaker. Hard-locks dispatch if slippage exceeds 0.5%.",
    9: "Filters funding rate arbitrage variance across GMX v2, HL, and CEX refs.",
    10: "Locks execution within 5 minutes of Hyperliquid funding settlement windows.",
    11: "Detects crowded long/short positioning to prevent squeeze liquidations.",
    12: `Validates spot-perp basis spreads before injecting ${brandDelta}-neutral hedges.`,
    13: "Validates active wallet session signature and execution key permissions.",
    14: "Injects unique Client Order IDs to physically prevent double-fill execution.",
    15: "Monitors cross-chain gas spikes and protocol fee friction.",
    16: "Ensures trade size does not exceed 1% of top-of-book depth.",
    17: "Choice A circuit lock: daily loss > Effective Max SL × 3 OR ≥ 3 SL trips per UTC day → ERROR 403.",
    18: "Enforces underlying Root 1 (Dynamic Max SL) even when Flash Mode bypasses surveys.",
    19: "Real-time order fill tracking and latency telemetry via Worker websockets.",
    20: "Mandatory psychological & execution review gate before unlocking the next trade.",
  },

  /** Canonical Root labels for telemetry rows (Full English) */
  ROOT_TELEMETRY_LABELS: {
    1: "Max Loss Weld (Dynamic SL)",
    2: "Geo Jurisdiction Lock",
    3: "checkSoilResistance()",
    4: "Close Spike Window",
    5: "VIX / DVOL Macro Fuse",
    6: "Beginner Cap Gate & Preset Modes",
    7: "Pre-Calculated Risk Boundary Lock",
    8: "Slippage Breaker (0.5%)",
    9: "Cross-Venue Yield Discrepancy",
    10: "Settlement Lockdown (<5m Window)",
    11: "Funding Extreme Simulation",
    12: `${brandDelta}-Neutral Basis Arbitrage Shield`,
    13: "Session & Address Auth Gatekeeper",
    14: "ClOID Anti-Replay & Deduplication",
    15: "Friction & Gas Cost Safeguard",
    16: "Order Depth-Impact Circuit Breaker",
    17: "Daily Drawdown Cap (Dynamic SL × 3 · 3 SL/day)",
    18: "Direct Access & Direct Bypass Circuit Lock",
    19: "ClOID Live Order Status & Execution Audit",
    20: "Post-Trade Review Closure",
  },
} as const;
