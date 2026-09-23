/**
 * Operator log sanitizer — map machine errors to cold quant console copy.
 * Never surface raw SQL / stack / API jargon to the public DEBUG CONSOLE.
 */

const PRODUCT = "BeΔ";

/** Map machine logs / errors into operator-facing English. */
export function humanizeSystemLog(raw: string): string {
  const line = String(raw ?? "").trim();
  if (!line) return "";

  const upper = line.toUpperCase();

  if (
    /CROSS_VENUE_SLIPPAGE|SPOT_PERP_SLIPPAGE|SOIL_RESISTANCE_TRIP|SPREAD_TOO_HIGH/.test(
      upper,
    ) ||
    /SOIL RESISTANCE CIRCUIT BREAKER TRIPPED/i.test(line)
  ) {
    return `[Risk] ${PRODUCT} soil capacity exceeded — order size auto-capped. Equity protected.`;
  }

  if (
    /CRI.?HARDLOCK|HARDLOCK|PHYSICAL DEADLOCK/i.test(upper) ||
    /CRI_HARDLOCK/i.test(line)
  ) {
    return `[Risk] Physical deadlock — CRI zeroed; Hot Key signing channel severed.`;
  }

  if (/ROOT_PROTECTION_TRIP|MAX.?SL|RISKLIMITEXCEEDED/i.test(line)) {
    return `[Risk] Dynamic Max SL engaged — max loss capped. Equity protected.`;
  }

  if (/DEPTH_USD|MINDEPTH/i.test(line)) {
    return `[Risk] Insufficient book depth — soil resistance rejected entry.`;
  }

  if (/RPC_NODE_NOT_ALLOWLISTED|NOT ON ALLOWLIST/i.test(line)) {
    return `[Risk] Unauthorized RPC host blocked — allowlist only.`;
  }

  if (/PIN LOCK|PINNED.*MAX|FOMO/i.test(line)) {
    return `[Risk] Watchlist hard-cap is 3 symbols — FOMO latch engaged.`;
  }

  if (/ALLMIDS.*FAILED|HL META.*FAILED|NETWORK ERROR|FETCH FAILED/i.test(line)) {
    return `[System] Market node busy — retry sync, then FORCE REFRESH.`;
  }

  if (/SQL(STATE|EXCEPTION|ERROR)|SQLITE|POSTGRES|MYSQL|PRAGMA/i.test(line)) {
    return `[System] Internal validation failed — safe degrade; UI remains available.`;
  }

  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|HTTP\s*[45]\d\d|STATUS\s*[45]\d\d/i.test(line)) {
    return `[System] External market feed interrupted — defense matrix on standby.`;
  }

  if (/STACK TRACE|AT\s+\S+\.(TS|JS):\d+|TYPEERROR:|REFERENCEERROR:/i.test(line)) {
    return `[System] Engine self-check tripped — fault isolated; service continues.`;
  }

  if (
    line.startsWith("[Risk]") ||
    line.startsWith("[System]") ||
    line.startsWith("[TRADFI]") ||
    line.startsWith("[allMids]") ||
    line.startsWith("[HL") ||
    line.startsWith("[API]") ||
    line.startsWith("[BUNDLE]") ||
    line.startsWith("[PIPELINE]") ||
    line.startsWith("[SYSTEM]")
  ) {
    return line;
  }

  if (/[{}\[\]]/.test(line) && /error|exception|failed/i.test(line)) {
    return `[System] Sync volatility absorbed — check panel for latest marks.`;
  }

  return line;
}

export function humanizeSystemLogs(lines: readonly string[]): string[] {
  return lines.map(humanizeSystemLog).filter(Boolean);
}
