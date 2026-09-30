/** HKT tsunami shield + HL orderbook gap time windows. */
export const TSUNAMI_SHIELD_HKT_START = 21;
export const TSUNAMI_SHIELD_HKT_END = 23;
const HKT_OFFSET_MS = 8 * 3_600_000;

export function getHktHour(now: Date = new Date()): number {
  return new Date(now.getTime() + HKT_OFFSET_MS).getUTCHours();
}

export function isTsunamiShieldWindow(now: Date = new Date()): boolean {
  const h = getHktHour(now);
  return h >= TSUNAMI_SHIELD_HKT_START && h < TSUNAMI_SHIELD_HKT_END;
}

export function isHlOrderbookGapWindow(now: Date = new Date()): boolean {
  if (isTsunamiShieldWindow(now)) return true;
  const day = now.getUTCDay();
  return day === 0 || day === 6;
}
