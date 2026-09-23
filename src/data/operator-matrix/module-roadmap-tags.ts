/** Grant-facing roadmap / reserve tags for stubbed operator modules. */

export const MODULE_ROADMAP_TAG = {
  V10_RESERVED: "[V1.0 RESERVED]",
  V15_ROADMAP: "[V1.5 ROADMAP]",
  V15_SIMULATION: "[ V1.5 Counter-MEV Simulation ]",
} as const;

export const OPERATOR_MODULE_TAGS: Readonly<Record<string, string>> = {
  BEDA: MODULE_ROADMAP_TAG.V10_RESERVED,
  W03: MODULE_ROADMAP_TAG.V10_RESERVED,
  W43: MODULE_ROADMAP_TAG.V15_ROADMAP,
  W47: MODULE_ROADMAP_TAG.V15_ROADMAP,
};

export function operatorModuleRoadmapTag(id: string): string | null {
  return OPERATOR_MODULE_TAGS[id] ?? null;
}

export function appendModuleRoadmapTag(label: string, tag: string | null): string {
  if (!tag || label.includes(tag)) return label;
  return `${label} ${tag}`;
}
