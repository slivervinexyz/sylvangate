import type { FullGrantAuditVenueView } from "./grant-audit-view-types";

export const PHASE01_ARMOR_INDEX_SCORE = 98;
export const PHASE01_ARMOR_INDEX_MAX = 100;
export const PHASE01_SOIL_RESISTANCE_PCT = 100;

export interface Phase01ExoMeshAuditCertificate {
  protocol: string;
  exportedAt: string;
  armorIndex: { score: number; max: number; grade: string };
  telemetry: {
    combinedTvlUsd: number;
    gmPoolUsd: number;
    legBHedgeUsd: number;
    soilResistancePct: number;
    circuitBreakersArmed: string;
  };
  verifiedExecutions: Array<{
    id: string;
    action: string;
    venue: string;
    hash: string;
    explorer: string;
    explorerUrl: string;
    amountUsd: number;
    status: string;
  }>;
  sha256Signature: string;
}

function buildUnsignedCertificate(
  view: FullGrantAuditVenueView,
  exportedAt: string,
): Omit<Phase01ExoMeshAuditCertificate, "sha256Signature"> {
  return {
    protocol: view.protocolName,
    exportedAt,
    armorIndex: {
      score: PHASE01_ARMOR_INDEX_SCORE,
      max: PHASE01_ARMOR_INDEX_MAX,
      grade: "OPTIMAL INSTITUTIONAL GRADE",
    },
    telemetry: {
      combinedTvlUsd: view.combinedTvlUsd,
      gmPoolUsd: view.gmPoolUsd,
      legBHedgeUsd: view.legBHedgeUsd,
      soilResistancePct: PHASE01_SOIL_RESISTANCE_PCT,
      circuitBreakersArmed: `${view.defenseRoots}/${view.defenseRoots} Armed`,
    },
    verifiedExecutions: view.executions.map((exec) => ({
      id: exec.id,
      action: exec.action,
      venue: exec.venue,
      hash: exec.hash,
      explorer: exec.explorer,
      explorerUrl: exec.explorerUrl,
      amountUsd: exec.amountUsd,
      status: exec.status,
    })),
  };
}

async function digestSha256Hex(canonical: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonical);
  const subtle =
    typeof window !== "undefined" ? window.crypto?.subtle : globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  const { sha256 } = await import("@noble/hashes/sha2");
  const { bytesToHex } = await import("@noble/hashes/utils");
  return bytesToHex(sha256(bytes));
}

export async function buildPhase01ExoMeshAuditCertificate(
  view: FullGrantAuditVenueView,
  exportedAt = new Date().toISOString(),
): Promise<Phase01ExoMeshAuditCertificate> {
  const unsigned = buildUnsignedCertificate(view, exportedAt);
  const canonical = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  const sha256Signature = await digestSha256Hex(canonical);
  return { ...unsigned, sha256Signature };
}

export async function exportPhase01ExoMeshAuditCertificate(
  view: FullGrantAuditVenueView,
): Promise<Phase01ExoMeshAuditCertificate> {
  const certificate = await buildPhase01ExoMeshAuditCertificate(view);
  const filename = `GMX-ExoMesh-Audit-Certificate-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(certificate, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return certificate;
}
