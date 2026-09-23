/**
 * Live RPC Grant Audit endpoint — re-exports API route + payload builders.
 */

export type {
  ArbitrumExomeshRiskMetrics,
  EngineModeStatus,
  GmxBuilderProof,
  GmxDataStoreStatus,
  GrantAuditOnChainProof,
  GrantAuditPayload,
  HlTelemetryMetrics,
  ProvenanceVerifiedTrades,
  ZeroDeltaProof,
} from "./grant-audit-lib/grant-audit.types";

export type { GrantAuditBlockProofs } from "./grant-audit-lib/grant-audit-block-proofs";
export type { GrantAuditDuneTelemetry } from "./grant-audit-lib/grant-audit-dune-telemetry";

export { extractTxHashes, proveZeroDelta } from "./grant-audit-lib/grant-audit-zero-delta";
export { buildGrantAuditPayload } from "./grant-audit-lib/grant-audit-payload";
export {
  handleGrantAuditRequest,
  isGrantAuditApiPath,
} from "../api/routes/grant-audit";

/** @deprecated Use isGrantAuditApiPath — HTML `/grant-audit` is SPA via ASSETS. */
export function isGrantAuditPath(pathname: string): boolean {
  return pathname === "/api/grant-audit";
}
