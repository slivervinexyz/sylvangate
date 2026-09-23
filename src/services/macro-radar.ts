/**
 * Macro Radar — shared calendar + DEFCON / macro-blocking windows.
 * Used by API SystemState CRI derivation and dashboard risk-client.
 */

export const MACRO_BLOCK_MS = 6 * 60 * 60 * 1000;

export interface MacroEventSpec {
  id: string;
  label: string;
  /** ISO-8601 UTC release timestamps */
  dates: string[];
}

/** Macro Radar Phase 1 calendar (UTC → HKT countdown) */
export const US_MACRO_EVENTS: MacroEventSpec[] = [
  {
    id: "macroFomcCountdown",
    label: "US FED FOMC",
    dates: [
      "2026-07-29T18:00:00Z",
      "2026-09-16T18:00:00Z",
      "2026-11-04T19:00:00Z",
      "2026-12-16T19:00:00Z",
    ],
  },
  {
    id: "macroCpiCountdown",
    label: "US CPI",
    dates: [
      "2026-08-12T12:30:00Z",
      "2026-09-11T12:30:00Z",
      "2026-10-14T12:30:00Z",
    ],
  },
  {
    id: "macroEcbCountdown",
    label: "EU ECB",
    dates: [
      "2026-09-11T12:15:00Z",
      "2026-10-30T12:15:00Z",
      "2026-12-18T13:15:00Z",
    ],
  },
  {
    id: "macroBojCountdown",
    label: "Asia BOJ",
    dates: [
      "2026-09-19T03:00:00Z",
      "2026-10-31T03:00:00Z",
      "2026-12-19T03:00:00Z",
    ],
  },
];

/** Next relevant release (still LIVE up to 2h after) */
export function nextMacroDate(dates: string[], now: Date = new Date()): number {
  const t = now.getTime();
  for (const iso of dates) {
    const d = new Date(iso).getTime();
    if (d + 2 * 3600 * 1000 > t) return d;
  }
  return new Date(dates[dates.length - 1]!).getTime();
}

/** Macro blocking window: LIVE or within 6h before release */
export function computeIsMacroBlocking(now: Date = new Date()): boolean {
  const t = now.getTime();
  for (const ev of US_MACRO_EVENTS) {
    const target = nextMacroDate(ev.dates, now);
    if (target - t <= MACRO_BLOCK_MS) return true;
  }
  return false;
}

/** DEFCON / high-vol emergency — mirrors Step 1 ALL-RED thresholds */
export function isMacroDefconEmergency(input: {
  vix?: number;
  dvol?: number;
  macroBlocking?: boolean;
  forceDefcon1?: boolean;
}): boolean {
  if (input.forceDefcon1) return true;
  if (input.macroBlocking) return true;
  if ((input.vix ?? 0) > 20) return true;
  if ((input.dvol ?? 0) > 55) return true;
  return false;
}
