/** v0 view fallback — wires SWR/client telemetry SSOT when live audit payload is absent. */
import { buildGrantAuditClientFallbackPayload } from "./grant-audit-client-fallback";
import { GRANT_AUDIT_SWR_ORACLE_LAG_MS } from "../../../routes/grant-audit-lib/grant-audit-swr-telemetry";

export function buildGrantAuditV0ViewFallback() {
  const payload = buildGrantAuditClientFallbackPayload();
  return {
    c: payload.arbitrumExomesh,
    hl: payload.hlTelemetry,
    pollSeq: 0,
    lagMs: GRANT_AUDIT_SWR_ORACLE_LAG_MS,
    seq: undefined,
    gas: undefined,
    resolved: null,
    lagHot: false,
    gasPct: 0,
    gasFill: "0%" as const,
    lagPct: 0,
    graceLeft: 0,
  };
}
