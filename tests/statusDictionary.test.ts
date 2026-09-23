import { describe, expect, it } from "vitest";
import {
  METRICS_DICTIONARY,
  STATUS_DICTIONARY,
  STRATEGY_DICTIONARY,
  metricsDictionaryJson,
  resolveStrategyKey,
  statusDictionaryJson,
  strategyDictionaryJson,
} from "../src/config/statusDictionary";

describe("STRATEGY_DICTIONARY", () => {
  it("exposes dual CASHCAT / REVERSE_CASHCAT entries with concise labels", () => {
    expect(STRATEGY_DICTIONARY.CASHCAT.label).toBe("[ ⚡ REC: CASH & CARRY ]");
    expect(STRATEGY_DICTIONARY.CASHCAT.actionText).toContain("Buy GMX Spot");
    expect(STRATEGY_DICTIONARY.REVERSE_CASHCAT.label).toBe(
      "[ ⚡ REC: REVERSE HEDGE ]",
    );
    expect(STRATEGY_DICTIONARY.REVERSE_CASHCAT.actionText).toContain(
      "Short HL Spot",
    );
    expect(STRATEGY_DICTIONARY.CASHCAT.color).toBe("#50D2C1");
    expect(STRATEGY_DICTIONARY.REVERSE_CASHCAT.color).toBe("#50D2C1");
  });

  it("resolves strategy key from funding direction and actionStatus", () => {
    expect(resolveStrategyKey({ fundingRateHourly: 0.0001 })).toBe("CASHCAT");
    expect(resolveStrategyKey({ fundingRateHourly: -0.0001 })).toBe(
      "REVERSE_CASHCAT",
    );
    expect(
      resolveStrategyKey({ actionStatus: "BUY_HL_SPOT_SHORT_HL_PERP" }),
    ).toBe("CASHCAT");
    expect(
      resolveStrategyKey({ actionStatus: "SHORT_HL_SPOT_LONG_HL_PERP" }),
    ).toBe("REVERSE_CASHCAT");
    expect(resolveStrategyKey({ strategyType: "REVERSE_CASHCAT" })).toBe(
      "REVERSE_CASHCAT",
    );
  });
});

describe("STATUS_DICTIONARY", () => {
  it("exposes grant-ready English status keys without hardcoded LONG SPOT labels", () => {
    expect(STATUS_DICTIONARY.TOP_BAR_STATUS.MARKET_HEARTBEAT.SAFE.label).toBe(
      "SAFE / STABLE",
    );
    expect(
      (STATUS_DICTIONARY.BEST_HEDGE_STRATEGY as { ACTION_RECOMMENDED?: unknown })
        .ACTION_RECOMMENDED,
    ).toBeUndefined();
    expect(STATUS_DICTIONARY.BEST_HEDGE_STRATEGY.LOCK_BUTTON.label).toContain(
      "LOCK BEST HEDGE",
    );
    expect(STATUS_DICTIONARY.SLIPPAGE_ALERT.CIRCUIT_BREAKER.color).toBe(
      "#FF4D4D",
    );
    expect(STATUS_DICTIONARY.SOIL_RESISTANCE.COMPACT.color).toBe("#50D2C1");
    expect(STATUS_DICTIONARY.MAX_SL_WELD.color).toBe("#50D2C1");
    expect(STATUS_DICTIONARY.MAX_SL_WELD.desc).toMatch(/Account Equity × 1%/);
  });

  it("serializes cleanly for dashboard client embed", () => {
    const status = JSON.parse(statusDictionaryJson()) as typeof STATUS_DICTIONARY;
    const strategy = JSON.parse(
      strategyDictionaryJson(),
    ) as typeof STRATEGY_DICTIONARY;
    const metrics = JSON.parse(
      metricsDictionaryJson(),
    ) as typeof METRICS_DICTIONARY;
    expect(status.VOLATILITY_HEAT.DANGER.label).toBe("DANGER");
    expect(status.BEST_HEDGE_STRATEGY.LOCK_BUTTON.desc).toMatch(/Effective Max SL/);
    expect(strategy.CASHCAT.label).toContain("CASH & CARRY");
    expect(metrics.HEAT.label).toContain("HEAT SCORE");
  });

  it("exposes Step 1 Root tags without duplicate Root 10 settlement pill", () => {
    const R = STATUS_DICTIONARY.ROOT_TAGS;
    expect(R.ROOT10_TSUNAMI.label).toBe(
      "[ R10: Tsunami Shield / Cross-DEX Settlement ]",
    );
    expect(R.ROOT10_TSUNAMI.desc).toMatch(/HKT 21-23/);
    expect(R.ROOT2_GEO_LOCK.ok).toBe("[ R2: GEO LOCK ]");
    expect(R.ROOT2_GEO_LOCK.lockDesc).toMatch(/Restricted IP/);
    expect(R.ROOT8_SLIPPAGE_BREAKER.ok).toBe("[ R8: SLIPPAGE BREAKER ]");
    expect(R.ROOT8_SLIPPAGE_BREAKER.desc).toMatch(/0\.5%/);
    expect(R.ROOT8_SLIPPAGE_BREAKER.tripDesc).toMatch(/TRIPPED/);
    expect(R.ROOT8_SLIPPAGE_BREAKER.tripDesc).toMatch(/>0\.5%/);
    expect(R.ROOT1_SL_WELD.label).toBe("[ R1: SL DYNAMIC WELD ]");
    expect(R.ROOT6_MINDSET.clear).toContain("R6");
    expect(R.ROOT5_MACRO_VOL.normal).toBe("[ R5: MACRO VOL ]");
    expect(R.ROOT5_MACRO_VOL.elevatedDesc).toMatch(/VIX \(>20\)/);
    expect(R.ROOT5_VIX.fail).toBe("[ R5: VIX FAIL ]");
    expect(R.ROOT5_VIX.failDesc).toMatch(/DVOL \(>55\)/);
    expect(R.ROOT10_SETTLEMENT.clear).toBe("[ R10: SETTLEMENT >5m ]");
    expect(R.ROOT10_SETTLEMENT.lockdownDesc).toMatch(/LOCKDOWN/);
    expect(R.ROOT3_SOIL.danger).toBe("[ R3: SOIL DANGER ]");
    expect(R.ROOT3_SOIL.dangerDesc).toMatch(/Effective Max SL/);
    expect(R.ROOT13_TARGET.locked).toContain("Target LOCKED");
    expect(R.ROOT18_STEP3.locked).toContain("STEP 3 LOCKED 🎯");
    expect(R.ROOT18_STEP3.direct).toContain("STEP 3 DIRECT ACCESS 🎯");
    expect(R.FLASH_ACTIVE.label).toContain("FLASH ACTIVE");
    expect(R).not.toHaveProperty("ROOT10_SETTLEMENT_PILL");
    expect(R).not.toHaveProperty("ROOT5_VOLATILITY");
  });

  it("exposes Pipeline Bar trade mode presets with English tooltips", () => {
    const M = STATUS_DICTIONARY.TRADE_MODES;
    expect(M.SHIELD.button).toBe("[ 🛡️ R6: Shield ]");
    expect(M.SHIELD.status).toBe("MAX DEFENSE (ALL 20 ROOTS)");
    expect(M.SHIELD.desc).toMatch(/Unlocked \(0 TXs\)/);
    expect(M.SHIELD.desc).toMatch(/20-Root/);
    expect(M.TACTICAL.button).toBe("[ ⚔️ R13: Tactical ]");
    expect(M.TACTICAL.lockTip).toMatch(/≥ 5/);
    expect(M.TACTICAL.desc).toMatch(/≥ 5 SliverVine Wallet TXs/);
    expect(M.TACTICAL.desc).toMatch(/dynamic Max SL/);
    expect(M.FLASH.button).toBe("[ ⚡ R18: Flash ]");
    expect(M.FLASH.lamp).toBe("HIGH SPEED");
    expect(M.FLASH.lockTip).toMatch(/≥ 20/);
    expect(M.FLASH.desc).toMatch(/≥ 20 SliverVine Wallet TXs/);
    expect(M.FLASH.desc).toMatch(/Root 1/);
    expect(M.FLASH.desc).toMatch(/Root 8/);
  });

  it("exposes Best Hedge lock copy for dark terminal radar", () => {
    expect(STATUS_DICTIONARY.BEST_HEDGE_STRATEGY.LOCK_BUTTON.label).toContain(
      "LOCK BEST HEDGE TO STEP 3",
    );
    expect(STATUS_DICTIONARY.BEST_HEDGE_STRATEGY.LOCK_BUTTON.desc).toMatch(
      /Effective Max SL/,
    );
    expect(STATUS_DICTIONARY.BEST_HEDGE_STRATEGY.AUTO_LOCKED.label).toBe(
      "[ 🎯 AUTO LOCKED ]",
    );
  });

  it("exposes Quick Tour and Demo Hub Full English copy with Root tips", () => {
    const Q = STATUS_DICTIONARY.QUICK_TOUR;
    expect(Q.TITLE).toBe("5-Sec Quick Guide");
    expect(Q.CTA).toContain("START EXECUTION");
    expect(Q.STEP1.roots).toBe("[R5/R6/R13]");
    expect(Q.STEP3.desc).toMatch(/Effective Max SL/);
    const D = STATUS_DICTIONARY.DEMO_HUB;
    expect(D.ROOT8_SLIPPAGE.label).toContain("Root 8");
    expect(D.CRI_TELEMETRY.label).toBe("ROOT DEFENSE MATRIX");
    expect(D.CRI_TELEMETRY.desc).toContain("Tier 4 (R16-R20)");
    expect(D.CRI_CONTROL.presets.NOMINAL).toBe("NOMINAL");
    expect(D.CRI_CONTROL.presets.TOXIC).toBe("TOXIC");
    expect(D.ROOT10_SETTLEMENT.desc).toMatch(/settlement/i);
    expect(D.DEFCON1.label).toContain("Kill-Switch");
    expect(D.WALLET_TX_LEVEL.label).toContain("Wallet TX Level Override");
    expect(D.WALLET_TX_LEVEL.options.SHIELD).toContain("0 TXs");
    expect(D.WALLET_TX_LEVEL.options.TACTICAL).toContain("Unlock Tactical");
    expect(D.WALLET_TX_LEVEL.options.FLASH).toContain("Unlock All");
    expect(STATUS_DICTIONARY.ROOT_TELEMETRY_TIPS[1]).toMatch(/Account Equity × 1%/);
    expect(STATUS_DICTIONARY.ROOT_TELEMETRY_TIPS[8]).toMatch(/0\.5%/);
    expect(STATUS_DICTIONARY.ROOT_TELEMETRY_TIPS[20]).toMatch(/review gate/i);
    const tiers = STATUS_DICTIONARY.ROOT_TELEMETRY_TIERS;
    expect(tiers.TIER1.header).toContain("STEP 1");
    expect(tiers.TIER2.roots).toEqual([7, 8, 9, 10, 11, 12]);
    expect(tiers.TIER3.roots).toEqual([13, 14, 15, 16, 17, 18]);
    expect(tiers.TIER4.roots).toEqual([19, 20]);
    expect(STATUS_DICTIONARY.ROOT_TELEMETRY_LABELS[18]).toMatch(/Flash Mode|Direct Bypass/i);
    expect(STATUS_DICTIONARY.ROOT_TELEMETRY_LABELS[6]).toMatch(/Preset Modes/);
  });
});
