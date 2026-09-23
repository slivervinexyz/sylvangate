import { BRAND_DELTA_SYMBOL } from "../constants";

const brandDelta = BRAND_DELTA_SYMBOL;

export const STATUS_DICTIONARY_STEP1_BOTTOM = {
  SLIPPAGE_ALERT: {
    ATTACK_READY: {
      label: "ATTACK READY",
      color: "#50D2C1",
      desc: "Spread and estimated slippage within acceptable risk thresholds.",
    },
    CIRCUIT_BREAKER: {
      label: "CIRCUIT BREAKER",
      color: "#FF4D4D",
      desc: "Orderbook depth too thin. Target temporarily locked.",
    },
  },
  SOIL_RESISTANCE: {
    COMPACT: {
      label: "SOIL: COMPACT",
      color: "#50D2C1",
      desc: "High orderbook depth (Slippage < 0.1%). Supports maximum capital execution.",
    },
    BALANCED: {
      label: "SOIL: BALANCED",
      color: "#45C4B4",
      desc: "Moderate depth (Slippage 0.1%-0.3%). Standard capital allocation.",
    },
    LOOSE: {
      label: "SOIL: LOOSE",
      color: "#FFD700",
      desc: "Thin orderbook depth (Slippage > 0.3%). Capital allocation auto-capped.",
    },
  },

  STATUS_HUD: {
    NORMAL: {
      emoji: "🟢",
      label: "Green Scan",
      subtitle: "Silent background monitoring",
      cssClass: "is-normal",
    },
    GROWTH: {
      emoji: "🟢",
      label: "+EXP, LEVEL UP!",
      subtitle: "Safe-zone XP progression burst",
      cssClass: "is-growth",
    },
    WARNING: {
      emoji: "🟡",
      label: "Amber Status / alert",
      subtitle: "Risk hawk eye activated",
      cssClass: "is-warning",
    },
    SHIELD: {
      emoji: "🛡️",
      label: "Shield Protocol",
      subtitle: "Deep root defense active",
      cssClass: "is-shield",
    },
    GOD_MODE: {
      emoji: "👁️",
      label: "SANTENMOKU PROTOCOL: ENGAGED",
      subtitle: "Three-Eyes physical override",
      cssClass: "is-god-mode",
    },
    BLOCKED: {
      emoji: "🔴",
      label: "ERROR 403 / DEADLOCK",
      subtitle: "100% execution deadlock",
      cssClass: "is-blocked",
    },
  },

  TRADE_MODES: {
    SHIELD: {
      label: "Shield",
      button: "[ 🛡️ R6: Shield ]",
      status: "MAX DEFENSE (ALL 20 ROOTS)",
      root: 6,
      desc: "Default Security Mode. Unlocked (0 TXs). Enforces all 20-Root defenses and macro gates.",
    },
    TACTICAL: {
      label: "Tactical",
      button: "[ ⚔️ R13: Tactical ]",
      status: "BALANCED DEFENSE",
      root: 13,
      lockTip: "Requires ≥ 5 SliverVine Wallet TXs to unlock",
      desc: "Unlocked via ≥ 5 SliverVine Wallet TXs. Streamlines macro gates while keeping dynamic Max SL & Soil Check active.",
    },
    FLASH: {
      label: "Flash",
      button: "[ ⚡ R18: Flash ]",
      status: "HIGH SPEED DIRECT ACCESS",
      lamp: "HIGH SPEED",
      root: 18,
      lockTip: "Requires ≥ 20 SliverVine Wallet TXs",
      desc: "Pro Sniper Mode. Unlocked via ≥ 20 SliverVine Wallet TXs. Direct access to Step 3 with welded Root 1 (Dynamic Max SL) & Root 8 (Slippage Breaker).",
    },
  },

  QUICK_TOUR: {
    TITLE: "5-Sec Quick Guide",
    CTA: "[ 🚀 START EXECUTION / ENTER SANDBOX ]",
    STEP1: {
      title: "Gatekeeper & Preset Roles",
      roots: "[R5/R6/R13]",
      desc: "Monitors macro volatility, session locks, and preset defense modes (Shield/Tactical/Flash) to unlock execution pathways.",
    },
    STEP2: {
      title: "Weak Target Radar",
      roots: "[R11/R12/R16]",
      desc: `Filters venue funding rate extremes and cross-venue yield discrepancies to lock optimal ${brandDelta}-neutral targets.`,
    },
    STEP3: {
      title: "Sniper Shield & Risk Engine",
      roots: "[R1/R3/R8]",
      desc: "Calculates dynamic order size based on soil resistance while enforcing Effective Max SL = (Equity × 1%) + $100.",
    },
    STEP4: {
      title: "Live Vault & Review Logs",
      roots: "[R14/R17/R19/R20]",
      desc: "Real-time vault position telemetry, ClOID order tracking, and automated post-trade review closure.",
    },
  },
} as const;
