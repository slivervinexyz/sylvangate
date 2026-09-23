/** UI SSOT — institutional compliance trip codes → reactive HUD alert copy. */

export const SYSTEM_FAIL_CLOSED_TRIP = "SYSTEM_FAIL_CLOSED_TRIP" as const;
export const BRIDGE_TIMEOUT_FAIL_CLOSED = "BRIDGE_TIMEOUT_FAIL_CLOSED" as const;
export const ORACLE_LAG_DEADLOCK = "ORACLE_LAG_DEADLOCK" as const;

export type ComplianceTripCode =
  | typeof SYSTEM_FAIL_CLOSED_TRIP
  | typeof BRIDGE_TIMEOUT_FAIL_CLOSED
  | typeof ORACLE_LAG_DEADLOCK;

export interface ComplianceTripAlert {
  code: ComplianceTripCode;
  title: string;
  message: string;
  severity: "critical" | "warning";
}

export const COMPLIANCE_TRIP_ALERTS: Readonly<Record<ComplianceTripCode, ComplianceTripAlert>> = {
  [SYSTEM_FAIL_CLOSED_TRIP]: {
    code: SYSTEM_FAIL_CLOSED_TRIP,
    title: "System Fail-Closed",
    message:
      "ExoMesh severed the signing channel — tradeAllowed: false. No GM/HL broadcast until soil, sequencer, and rootProtection gates clear.",
    severity: "critical",
  },
  [BRIDGE_TIMEOUT_FAIL_CLOSED]: {
    code: BRIDGE_TIMEOUT_FAIL_CLOSED,
    title: "Bridge Timeout Fail-Closed",
    message:
      "Across escort exceeded 1h without settlement — capital remains IN_FLIGHT; naked delta forbidden · lostUsd ≡ 0.",
    severity: "critical",
  },
  [ORACLE_LAG_DEADLOCK]: {
    code: ORACLE_LAG_DEADLOCK,
    title: "Oracle Lag Deadlock",
    message:
      "Chainlink staleness >30s — ORACLE_LAG_DEADLOCK armed. Dispatch blocked until oracle freshness restores.",
    severity: "critical",
  },
};

const TRIP_REASON_PATTERNS: Readonly<
  Record<ComplianceTripCode, readonly RegExp[]>
> = {
  [SYSTEM_FAIL_CLOSED_TRIP]: [
    /SYSTEM_FAIL_CLOSED_TRIP/i,
    /signingChannelOpen\s*=\s*false/i,
    /rootProtection/i,
    /R20_(LOCKED|HARDLOCK)/i,
    /tradeAllowed\s*:\s*false/i,
  ],
  [BRIDGE_TIMEOUT_FAIL_CLOSED]: [/BRIDGE_TIMEOUT_FAIL_CLOSED/i],
  [ORACLE_LAG_DEADLOCK]: [/ORACLE_LAG_DEADLOCK/i],
};

/** Map backend trip reason strings to UI alert payloads (deduped, stable order). */
export function resolveComplianceAlertsFromReasons(
  reasons: readonly string[],
): ComplianceTripAlert[] {
  const seen = new Set<ComplianceTripCode>();
  const out: ComplianceTripAlert[] = [];
  for (const code of Object.keys(COMPLIANCE_TRIP_ALERTS) as ComplianceTripCode[]) {
    const patterns = TRIP_REASON_PATTERNS[code];
    if (reasons.some((r) => patterns.some((p) => p.test(r)))) {
      if (!seen.has(code)) {
        seen.add(code);
        out.push(COMPLIANCE_TRIP_ALERTS[code]);
      }
    }
  }
  return out;
}

export function hasCriticalComplianceTrip(
  alerts: readonly ComplianceTripAlert[],
): boolean {
  return alerts.some((a) => a.severity === "critical");
}
