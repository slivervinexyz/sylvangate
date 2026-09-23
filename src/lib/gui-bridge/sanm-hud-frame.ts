import mockSanmHUD from "../../data/mockSanmHUD.json";

export interface SanmHudFrame {
  minute: number;
  system_status: string;
  nirvana_rwa_evacuation_triggered: boolean;
  isomorphic_metrics: {
    fci_index: number;
    hawking_chronology_protection_delta: number;
    string_tension_amplitude: number;
  };
  chakra_flow: {
    active_center: string;
  };
}

export interface SanmHudCatalog {
  schema: string;
  defaultStep: number;
  frames: SanmHudFrame[];
}

const catalog = mockSanmHUD as SanmHudCatalog;

function readStepFromQuery(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("sanm_step");
  if (!raw) return null;
  const step = Number.parseInt(raw, 10);
  return Number.isFinite(step) ? step : null;
}

export function resolveSanmHudFrame(step?: number): SanmHudFrame {
  const index = step ?? readStepFromQuery() ?? catalog.defaultStep;
  return catalog.frames[index] ?? catalog.frames[catalog.defaultStep] ?? catalog.frames[0]!;
}

export function isEvacuationTriggered(frame: SanmHudFrame): boolean {
  return frame.nirvana_rwa_evacuation_triggered === true;
}

/** Explicit reviewer demo — never infer evacuation from catalog default alone. */
export function isExplicitSanmEvacuationDemo(step?: number): boolean {
  if (step !== undefined) {
    return isEvacuationTriggered(resolveSanmHudFrame(step));
  }
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("sanm_evac") === "1") return true;
  const queryStep = readStepFromQuery();
  if (queryStep == null) return false;
  return isEvacuationTriggered(resolveSanmHudFrame(queryStep));
}
