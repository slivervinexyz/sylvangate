import { BRAND_DELTA_SYMBOL } from "../constants";
import {
  AUTO_PILOT_BASIS_BADGE,
  MILESTONE_SANDBOX_BADGE,
} from "../../services/copilot-care-messages";

const brandDelta = BRAND_DELTA_SYMBOL;

export const STATUS_DICTIONARY_STEP1_TOP = {
  TOP_BAR_STATUS: {
    MINDSET:
      "Mindset Status: Psychological discipline check before executing trades.",
    VIX_DVOL:
      "Volatility Index: Real-time implied volatility reading from options/DVOL.",
    TARGET_LOCK:
      "Target State: Indicates whether a token is locked & ready in Step 3.",
    MARKET_HEARTBEAT: {
      SAFE: {
        label: "SAFE / STABLE",
        color: "#50D2C1",
        desc: "Market structure stable. All safety circuit breakers disarmed.",
      },
      ELEVATED: {
        label: "ELEVATED VOL",
        color: "#FFD700",
        desc: "Volatility spiking. Position sizing automatically throttled.",
      },
      LOCKED: {
        label: "CIRCUIT TRIGGERED",
        color: "#FF4D4D",
        desc: "Extreme volatility detected. Step 3 execution hard-locked.",
      },
    },
  },

  BEST_HEDGE_STRATEGY: {
    LOCK_BUTTON: {
      label: "[ 🔒 LOCK BEST HEDGE TO STEP 3 ]",
      desc: `Auto-injects optimal ${brandDelta}-neutral strategy with dynamic Effective Max SL = (Equity × 1%) + $100. ${AUTO_PILOT_BASIS_BADGE}`,
    },
    AUTO_LOCKED: {
      label: "[ 🎯 AUTO LOCKED ]",
      desc: `Top-ranked ${brandDelta}-neutral hedge auto-selected by APR / funding edge.`,
    },
    AUTO_PILOT: {
      label: AUTO_PILOT_BASIS_BADGE,
      desc: "One-click basis arbitrage — optimal ratio computed and Step 3 pre-filled without page reload.",
    },
    MILESTONE: {
      label: MILESTONE_SANDBOX_BADGE,
      desc: "Cross-chain live settlement ships in Milestone 2; sandbox execution is active today.",
    },
  },

  MAX_SL_WELD: {
    label: "MAX SL DYNAMIC WELD",
    color: "#50D2C1",
    desc: "Dynamic Limit Enforced: Effective Max SL USD = (Account Equity × 1%) + $100. Auto-calculates Dynamic Stop-Loss % based on order size and live equity.",
  },

  VOLATILITY_HEAT: {
    SAFE: {
      label: "SAFE",
      color: "#50D2C1",
      desc: "Low market stress. Deep orderbooks and low slippage.",
    },
    ELEVATED: {
      label: "ELEVATED",
      color: "#FFD700",
      desc: "Elevated market stress. Limit orders strongly recommended.",
    },
    DANGER: {
      label: "DANGER",
      color: "#FF4D4D",
      desc: "Extreme market stress. Slippage circuit breaker activated.",
    },
  },
} as const;
