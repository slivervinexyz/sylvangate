/**
 * v1.0 Santenmoku Operator Matrix — Category Prefix SSOT (UM / BO / RA).
 * Scale-down HUD (v0.8–v1.5) shows continuous per-category numbering only.
 */

export type OperatorCategoryId = "UMBRELLA" | "BOOTS" | "RAINCOAT";
export type OperatorCategoryPrefix = "UM" | "BO" | "RA";

export const CATEGORY_PREFIX: Readonly<Record<OperatorCategoryId, OperatorCategoryPrefix>> = {
  UMBRELLA: "UM",
  BOOTS: "BO",
  RAINCOAT: "RA",
};

/** Internal weapon id → standardized display code (grant-safe, low-profile). */
export const OPERATOR_DISPLAY_CODE: Readonly<Record<string, string>> = {
  W43: "UM-01",
  W47: "UM-02",
  BITWISE: "UM-03",
  W04: "UM-04",
  W05: "UM-05",
  W06: "UM-06",
  W07: "UM-07",
  W08: "UM-08",
  W09: "UM-09",
  W10: "UM-10",
  W11: "UM-11",
  W13: "UM-12",
  W14: "UM-13",
  W16: "UM-14",
  W17: "UM-15",
  W18: "UM-16",
  W19: "UM-17",
  W20: "UM-18",
  SOIL: "BO-01",
  BEDA: "BO-02",
  ROOT: "RA-01",
  SSOT: "RA-02",
  W03: "RA-03",
};

/** v1.5 milestone scale-down roster — 22 operators (no W23+ in UI). */
export const SCALE_DOWN_OPERATOR_IDS: readonly string[] = [
  "W43",
  "W47",
  "W04",
  "W05",
  "W06",
  "W07",
  "W08",
  "W09",
  "W10",
  "W11",
  "W13",
  "W14",
  "W16",
  "W17",
  "W18",
  "W19",
  "W20",
  "SOIL",
  "BEDA",
  "ROOT",
  "SSOT",
  "W03",
] as const;

const SCALE_DOWN_SET = new Set<string>(SCALE_DOWN_OPERATOR_IDS);

export const SCALE_DOWN_OPERATOR_COUNT = SCALE_DOWN_OPERATOR_IDS.length;

export function operatorDisplayCode(weaponId: string): string | null {
  return OPERATOR_DISPLAY_CODE[weaponId] ?? null;
}

export function isScaleDownOperator(weaponId: string): boolean {
  return SCALE_DOWN_SET.has(weaponId);
}

export function formatOperatorPrefixLabel(weaponId: string, name: string): string {
  const code = operatorDisplayCode(weaponId);
  return code ? `${code} ${name}` : name;
}

export function scaleDownOperatorsForCategory(
  categoryId: OperatorCategoryId,
  weaponIds: readonly string[],
): string[] {
  const prefix = CATEGORY_PREFIX[categoryId];
  return weaponIds.filter(isScaleDownOperator).sort((a, b) => {
    const ca = operatorDisplayCode(a) ?? "";
    const cb = operatorDisplayCode(b) ?? "";
    if (ca.startsWith(prefix) && cb.startsWith(prefix)) {
      return ca.localeCompare(cb, undefined, { numeric: true });
    }
    return ca.localeCompare(cb);
  });
}
