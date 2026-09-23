/** GMX v2 Grant Audit Certificate — SHA-256 export SSOT. */
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import type { ArbitrumExomeshRiskMetrics } from "../../../routes/grant-audit-lib/grant-audit-exomesh-metrics";
import type { HlTelemetryMetrics } from "../../../routes/grant-audit-lib/grant-audit.types";
import { resolveGrantAuditVenueView } from "./exomesh-grant-audit-metrics";

export const GMX_GRANT_AUDIT_CERT_FILENAME = "GMX_v2_Grant_Audit_Certificate.json";

export interface GmxGrantAuditCertificate {
  protocol: "SliverVine Protocol (BeDelta Living Water v1.0 / BeΔ)";
  gmxGmPoolTvl: string;
  aggregateHedgedTvl: string;
  status: "Zero-Δ Dynamic Shield Active";
  exportedAt: string;
  sha256Hash: string;
}

function hashCertificateBody(
  body: Omit<GmxGrantAuditCertificate, "sha256Hash">,
): string {
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

export function buildGmxGrantAuditCertificate(
  metrics?: ArbitrumExomeshRiskMetrics | null,
  hlTelemetry?: HlTelemetryMetrics | null,
): GmxGrantAuditCertificate {
  const view = resolveGrantAuditVenueView(metrics, 0, hlTelemetry);
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unsigned = {
    protocol: "SliverVine Protocol (BeDelta Living Water v1.0 / BeΔ)" as const,
    gmxGmPoolTvl: `$${fmt(view.gmPoolUsd)} USDC`,
    aggregateHedgedTvl: `$${fmt(view.combinedTvlUsd)} USDC`,
    status: "Zero-Δ Dynamic Shield Active" as const,
    exportedAt: new Date().toISOString(),
  };
  return {
    ...unsigned,
    sha256Hash: hashCertificateBody(unsigned),
  };
}

export function exportGmxGrantAuditCertificate(
  metrics?: ArbitrumExomeshRiskMetrics | null,
  hlTelemetry?: HlTelemetryMetrics | null,
): GmxGrantAuditCertificate {
  const certificate = buildGmxGrantAuditCertificate(metrics, hlTelemetry);
  const blob = new Blob([JSON.stringify(certificate, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = GMX_GRANT_AUDIT_CERT_FILENAME;
  anchor.click();
  URL.revokeObjectURL(url);
  return certificate;
}
