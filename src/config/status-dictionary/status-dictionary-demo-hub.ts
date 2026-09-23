/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 *
 * Status dictionary — Demo Control Hub risk toggle labels + tooltips.
 */

import { ROOT_DEFENSE_MATRIX_TOOLTIP_DESC } from "../../services/cri-engine";

export const STATUS_DICTIONARY_DEMO_HUB = {
  /** Demo Control Hub — Risk Toggle labels + tooltips */
  DEMO_HUB: {
    INTRO: "Centralized risk simulation switches · Does not affect live on-chain execution.",
    SANDBOX: {
      label: "DEMO SANDBOX MODE",
      desc: "Dry-run execution path — zero-key sandbox; toggles SystemState.isSandboxMode for demo walkthroughs.",
    },
    TELEMETRY_INTRO:
      "20-Root Defense Matrix grouped by Step 1–4 Tier Levels · Hover any Root for algorithm tip",
    WALLET_TX_LEVEL: {
      label: "[ Wallet TX Level Override ]",
      desc: "Mock HL wallet fill count to unlock Shield / Tactical / Flash micro-tabs for demo.",
      options: {
        SHIELD: "0 TXs (Shield Only)",
        TACTICAL: "5 TXs (Unlock Tactical)",
        FLASH: "20+ TXs (Unlock All / Flash)",
      },
    },
    ROOT8_SLIPPAGE: {
      label: "[ Root 8: Slippage Breaker Demo ]",
      desc: "Simulates physical slippage breaker triggers to force circuit locks.",
    },
    ROOT10_SETTLEMENT: {
      label: "[ Root 10: Settlement Lockdown Sim ]",
      desc: "Simulates Hyperliquid funding rate settlement volatility locks.",
    },
    ROOT11_FUNDING: {
      label: "[ Root 11: Funding Extreme Sim ]",
      desc: "Simulates extreme funding rate spikes to trigger long/short crowding warnings.",
    },
    ROOT13_GATEKEEPER: {
      label: "[ Root 13: Gatekeeper Switch ]",
      desc: "Toggles session gatekeeper authorization status (PASS / BLOCKED).",
    },
    CRI_TELEMETRY: {
      label: "ROOT DEFENSE MATRIX",
      desc: ROOT_DEFENSE_MATRIX_TOOLTIP_DESC,
    },
    CRI_CONTROL: {
      label: "Defense Presets",
      desc: "Manual ROOT DEFENSE MATRIX override presets for demo walkthroughs. Instantly updates Main Header score, status bar, and DonDon IP visual state.",
      presets: {
        NOMINAL: "NOMINAL",
        WARNING: "WARNING",
        TOXIC: "TOXIC",
        GOD: "DEFCON 1",
      },
      presetTips: {
        NOMINAL:
          "Instantly sets ROOT DEFENSE MATRIX to 100 — optimal green HUD and calm DonDon IP state.",
        WARNING:
          "Sets ROOT DEFENSE MATRIX to 50 — amber warning band; mirrors elevated macro stress.",
        TOXIC:
          "Sets ROOT DEFENSE MATRIX to 20 — toxic circuit posture; triggers hard execution lockdown demo.",
        GOD: "DEFCON 1 global kill-switch — maximum emergency posture across all pipeline steps.",
      },
      resetBtn: "Reset Toxic Lock",
    },
    XP_CONTROLS: {
      label: "[ XP / Level Progression Override ]",
      desc: "Mock RPG XP to trigger GROWTH HUD state when ROOT DEFENSE MATRIX ≤ 25. Drives BEGINNER / INTERMEDIATE / EXPERT tier.",
      presets: {
        PLUS_10: "+10 XP",
        RESET: "Reset XP",
      },
    },
    ROOT_TOGGLES: {
      label: "[ 20-Root ROOT DEFENSE MATRIX Toggles ]",
      desc: "Simulate individual Root trips — immediately recalculates ROOT DEFENSE MATRIX score and updates Main Header + ROOT LED matrix.",
    },
    DEFCON1: {
      label: "[ DEFCON 1: Global Emergency Kill-Switch ]",
      desc: "Triggers global circuit kill-switch. Hard-locks all execution steps.",
      toggleBtn: "[ 🚨 Toggle DEFCON 1 ]",
    },
  },
} as const;
