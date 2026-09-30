/** Buildathon submission safe hour — 2026-09-12T06:00:00Z = HKT 14:00 (outside tsunami window). */
export const SAFE_TRADING_TIME = new Date("2026-09-12T06:00:00.000Z");

/** Weekday safe hour — 2026-09-14T06:00:00Z = Mon HKT 14:00 (outside tsunami + weekend HIP-3 gap). */
export const WEEKDAY_SAFE_TRADING_TIME = new Date("2026-09-14T06:00:00.000Z");

/** Tsunami shield probe — 2026-09-12T13:30:00Z = HKT 21:30 (inside 21:00–23:00 lock). */
export const TSUNAMI_SHIELD_TIME = new Date("2026-09-12T13:30:00.000Z");
