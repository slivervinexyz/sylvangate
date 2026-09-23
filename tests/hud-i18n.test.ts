/**
 * HUD UX — i18n defaults.
 */
import { describe, expect, it } from "vitest";
import {
  WEAPON_TOOLTIPS,
  UI_I18N,
  TOPOLOGY_DOMAIN_I18N,
  KPI_TOOLTIPS,
} from "../src/lib/gui-bridge/hud-i18n";
import { TOPOLOGY_SHIELD_TREE } from "../src/services/tension-engine-service";

describe("HUD i18n English strings", () => {
  it("exposes English UI copy and weapon tooltips", () => {
    expect(UI_I18N.en.centralHub).toBe("Central Defense Core");
    expect(UI_I18N.en.optimize).toContain("Geometric Optimize");
    expect(UI_I18N.en.wikiButton).toContain("Weapon Wiki");
    expect(UI_I18N.en.shieldTree).toContain("SANTENMOKU WEAPONS MATRIX");
    expect(UI_I18N.en.brandTitle).toContain("SANTENMOKU");
    expect(WEAPON_TOOLTIPS.SOIL.code).toBe("BO-01");
    expect(WEAPON_TOOLTIPS.ROOT.code).toBe("RA-01");
    expect(WEAPON_TOOLTIPS.SSOT.code).toBe("RA-02");
    expect(WEAPON_TOOLTIPS.BEDA.code).toBe("BO-02");
    expect(WEAPON_TOOLTIPS.W03.code).toBe("RA-03");
    expect(WEAPON_TOOLTIPS.BITWISE.code).toBe("UM-03");
    expect(WEAPON_TOOLTIPS.SOIL.labelEn).toContain("BO-01");
    expect(WEAPON_TOOLTIPS.SOIL.en).toContain("book depth");
    expect(WEAPON_TOOLTIPS.ROOT.en).toContain("0% ruin");
    expect(WEAPON_TOOLTIPS.BITWISE.en).toContain("counter");
    expect(WEAPON_TOOLTIPS.W43.code).toBe("UM-01");
    expect(WEAPON_TOOLTIPS.W47.code).toBe("UM-02");
    expect(WEAPON_TOOLTIPS.W58.code).toBe("W58");
    expect(WEAPON_TOOLTIPS.W64.code).toBe("W64");
    expect(KPI_TOOLTIPS.shieldMorph).toContain("Ruin Lock");
    expect(KPI_TOOLTIPS.tension).toContain("50.00");
    expect(TOPOLOGY_DOMAIN_I18N.NODE_ALPHA).toBe("Physical Protection");
    expect(TOPOLOGY_DOMAIN_I18N.NODE_ZETA).toContain("Roadmap");
  });

  it("covers every shield-tree weapon with tooltip + target", () => {
    for (const card of TOPOLOGY_SHIELD_TREE) {
      for (const w of card.weapons) {
        const tip = WEAPON_TOOLTIPS[w.id];
        expect(tip, `missing tooltip ${w.id}`).toBeDefined();
        expect(tip!.en.length).toBeGreaterThan(8);
        expect(tip!.targetEn.length).toBeGreaterThan(2);
        expect(tip!.code.length).toBeGreaterThan(1);
      }
    }
  });
});
