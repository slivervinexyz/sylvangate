/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 *
 * Status dictionary — Step 1 Root-tagged indicators + hover tooltips.
 */

export const STATUS_DICTIONARY_ROOTS = {
  /** Step 1 Root-tagged indicators + hover tooltips (Full English) */
  ROOT_TAGS: {
    ROOT5_VIX_DVOL: {
      label: "[ R5: VIX/DVOL ]",
      desc: "Monitors VIX/DVOL composite index to prevent trading during extreme market turbulence.",
    },
    ROOT13_SESSION: {
      label: "[ R13: Session Gatekeeper ]",
      desc: "Tracks global market trading hours and liquidity venue transitions.",
    },
    ROOT10_TSUNAMI: {
      label: "[ R10: Tsunami Shield / Cross-DEX Settlement ]",
      desc: "Monitors Cross-DEX funding settlement (GMX + HL) and HKT 21-23 volatility windows.",
    },
    ROOT2_GEO_LOCK: {
      ok: "[ R2: GEO LOCK ]",
      fail: "[ R2: GEO LOCK · BLOCKED ]",
      desc: "Jurisdiction gate: blocks execution from geo-restricted geos.",
      lockDesc:
        "LOCKED: Restricted IP or regional compliance barrier triggered. API execution key isolated.",
    },
    ROOT8_SLIPPAGE_BREAKER: {
      ok: "[ R8: SLIPPAGE BREAKER ]",
      fail: "[ R8: SLIPPAGE BREAKER · TRIP ]",
      desc: "Physical slippage circuit breaker (0.5% max limit) active.",
      tripDesc:
        "TRIPPED: Estimated slippage (>0.5%) exceeds safety margin. Execution hard-locked to prevent flash crashes.",
    },
    ROOT1_SL_WELD: {
      label: "[ R1: SL DYNAMIC WELD ]",
      desc: "Dynamic capital protection limit. Single trade max loss = (Account Equity × 1%) + $100 USD.",
    },
    ROOT_MACRO_FILTER: {
      label: "[ R5/R10 Macro Filter ]",
      desc: "Real-time calendar tracking macro event risks (FOMC, CPI) to avoid black-swan volatility.",
    },
    /** Pipeline Bar (auto-guard banner) Root tags */
    ROOT6_MINDSET: {
      clear: "[ R6: Mindset CLEAR ]",
      stressed: "[ R6: Mindset STRESSED ]",
      desc: "Mindset Status: Psychological discipline check before executing trades.",
    },
    ROOT5_MACRO_VOL: {
      normal: "[ R5: MACRO VOL ]",
      elevated: "[ R5: MACRO VOL · ELEVATED ]",
      desc: "Macro volatility gate from VIX/DVOL composite before Step 3 unlock.",
      elevatedDesc:
        "ELEVATED: VIX (>20) or DVOL (>55) macro volatility surge detected. Direct market orders blocked.",
    },
    /** Shield / Tactical Pipeline Bar — Root 5 VIX gate */
    ROOT5_VIX: {
      pass: "[ R5: VIX PASS ]",
      fail: "[ R5: VIX FAIL ]",
      desc: "Volatility Index: Real-time implied volatility reading from options/DVOL.",
      failDesc:
        "ELEVATED: VIX (>20) or DVOL (>55) macro volatility surge detected. Direct market orders blocked.",
    },
    /** Shield / Tactical Pipeline Bar — Root 10 settlement gate */
    ROOT10_SETTLEMENT: {
      clear: "[ R10: SETTLEMENT >5m ]",
      lockdown: "[ R10: SETTLEMENT LOCKDOWN ]",
      desc: "Monitors Cross-DEX funding settlement (GMX + HL) and HKT 21-23 volatility windows.",
      lockdownDesc:
        "LOCKDOWN: Hyperliquid Funding Rate Settlement active (<5m window) or HKT 21-23 US Open surge. Orders paused to prevent oracle gap slippage.",
    },
    /** Shield / Tactical Pipeline Bar — Root 3 soil gate */
    ROOT3_SOIL: {
      safe: "[ R3: SOIL SAFE ]",
      danger: "[ R3: SOIL DANGER ]",
      desc: "Soil Resistance: Orderbook depth vs dynamic Effective Max SL risk boundary before Step 3 unlock.",
      dangerDesc:
        "DANGER: Liquidity depth-to-impact ratio failed check. Max risk exceeds Effective Max SL threshold.",
    },
    ROOT13_TARGET: {
      locked: "[ R13: Target LOCKED ]",
      pending: "[ R13: Target PENDING ]",
      desc: "Target State: Indicates whether a token is locked & ready in Step 3.",
    },
    ROOT18_STEP3: {
      locked: "[ R18: STEP 3 LOCKED 🎯 ]",
      unlocked: "[ R18: STEP 3 UNLOCKED 🎯 ]",
      direct: "[ 🔓 STEP 3 DIRECT ACCESS 🎯 ]",
      desc: "Step 3 execution gate — unlocks only when upstream Root checks pass.",
    },
    /** Flash Pipeline Bar — survey bypass + physical welds */
    FLASH_ACTIVE: {
      label: "[ ⚡ FLASH ACTIVE: SURVEY BYPASSED ]",
      desc: "Pro Sniper Mode. Survey gates bypassed. Root 1 (Dynamic Max SL) and Root 8 (Slippage Breaker) remain welded.",
    },
  },
} as const;
