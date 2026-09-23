export const PENDLE_SHIELD_API = {
  shadowMargin: "/api/pendle-shield/shadow-margin",
  autoRoll: "/api/pendle-shield/auto-roll",
} as const;

export function isPendleShieldApiPath(pathname: string): boolean {
  return (
    pathname === PENDLE_SHIELD_API.shadowMargin ||
    pathname === PENDLE_SHIELD_API.autoRoll
  );
}
