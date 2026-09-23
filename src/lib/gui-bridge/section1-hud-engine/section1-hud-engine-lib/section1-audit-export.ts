import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { buildNegativeProofsArtifact } from "../../../../core/negative-proofs-artifact";
import { computeVerified5TxSha256Anchor } from "../../../../data/verified-5tx";
import type {
  DryRunPlaybookJson,
  Sha256AuditCertificate,
  SilvervineTcaAuditProof,
  SoilResistanceLogEntry,
  TxBatchRecord,
} from "../section1-hud-types";
import { buildGrantProofMarkdown } from "./section1-grant-proof";

function signSha256AuditCertificateBody(
  body: Omit<Sha256AuditCertificate, "certificateSignature">,
): string {
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

export function buildSha256AuditCertificate(
  batch: TxBatchRecord,
  soilLogs: readonly SoilResistanceLogEntry[],
): Sha256AuditCertificate {
  const sha256Anchor = computeVerified5TxSha256Anchor(batch.results.fills);
  const markdown = [
    buildGrantProofMarkdown(batch),
    "",
    "## SliverVine SHA-256 Audit Certificate",
    "",
    `- Certificate Version: \`c1\``,
    `- Exported At: \`${new Date().toISOString()}\``,
    `- Soil Resistance Logs: \`${soilLogs.length}\``,
    "",
    "> Cryptographic signature covers canonical JSON payload (SHA-256 digest).",
  ].join("\n");
  const unsigned = {
    protocol: "SliverVine" as const,
    engine: "v1.0 Santenmoku" as const,
    certificateVersion: "c1" as const,
    exportedAt: new Date().toISOString(),
    batchId: batch.id,
    sha256Anchor,
    fillHashes: batch.results.fills.map((fill) => fill.txHash),
    sessionKey: batch.results.wallet,
    soilResistanceLogs: [...soilLogs],
    markdown,
  };
  return {
    ...unsigned,
    certificateSignature: signSha256AuditCertificateBody(unsigned),
  };
}

export function exportSha256AuditCertificate(
  batch: TxBatchRecord,
  soilLogs: readonly SoilResistanceLogEntry[],
): void {
  const certificate = buildSha256AuditCertificate(batch, soilLogs);
  const blob = new Blob([JSON.stringify(certificate, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "silvervine_sha256_audit_certificate.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

const DRY_RUN_PLAYBOOK_GATES: readonly (readonly string[])[] = [
  ["R20_LOCK", "ROOT_PROTECTION", "SOIL_RESISTANCE", "HL_DRY_RUN"],
  ["R20_LOCK", "ROOT_PROTECTION", "SOIL_RESISTANCE", "POLYMARKET_DRY_RUN"],
  ["R20_LOCK", "ROOT_PROTECTION", "SOIL_RESISTANCE", "JUPITER_DRY_RUN"],
] as const;

const DRY_RUN_PLAYBOOK_VENUES = ["HL", "POLYMARKET", "JUPITER"] as const;
const DRY_RUN_PLAYBOOK_PHASES = ["PREPARE", "VERIFY", "COMMIT", "COMPENSATE"] as const;

export function buildDryRunPlaybookJson(
  batch: TxBatchRecord,
  soilLogs: readonly SoilResistanceLogEntry[],
): DryRunPlaybookJson {
  const sha256Anchor = computeVerified5TxSha256Anchor(batch.results.fills);
  const sandboxSequence: DryRunPlaybookJson["sandboxSequence"] =
    DRY_RUN_PLAYBOOK_VENUES.map((venue, index) => ({
      step: index + 1,
      venue,
      event: "GRANT_SANDBOX_DRY_RUN" as const,
      zeroKeyDryRun: true as const,
      apiKeysRequired: false as const,
      sagaPhase: DRY_RUN_PLAYBOOK_PHASES[index] ?? "COMMIT",
      tradeAllowed: true,
      passedGates: [...(DRY_RUN_PLAYBOOK_GATES[index] ?? DRY_RUN_PLAYBOOK_GATES[0]!)],
    }));

  return {
    protocol: "SliverVine",
    engine: "v1.0 Santenmoku",
    playbookVersion: "c15",
    exportedAt: new Date().toISOString(),
    zeroKeyDryRun: true,
    apiKeysRequired: false,
    hyperliquidTestnetCompatible: true,
    sha256Anchor,
    timestamp: batch.results.timestamp,
    soilAuditLogs: [...soilLogs],
    sagaEngine: {
      phases: ["PREPARE", "VERIFY", "COMMIT", "COMPENSATE"],
      failClosedMs: 500,
    },
    verified5TxBatch: {
      wallet: batch.results.wallet,
      fillCount: batch.results.fills.length,
      fillHashes: batch.results.fills.map((fill) => fill.txHash),
    },
    sandboxSequence,
  };
}

export function exportDryRunPlaybookJson(
  batch: TxBatchRecord,
  soilLogs: readonly SoilResistanceLogEntry[],
): void {
  const playbook = buildDryRunPlaybookJson(batch, soilLogs);
  const blob = new Blob([JSON.stringify(playbook, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "silvervine_dry_run_playbook.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportNegativeProofsArtifact(): void {
  const artifact = buildNegativeProofsArtifact();
  const blob = new Blob([JSON.stringify(artifact, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "negative-proofs-artifact.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportSilvervineTcaAuditProof(
  batch: TxBatchRecord,
  soilLogs: readonly SoilResistanceLogEntry[],
): void {
  const proof: SilvervineTcaAuditProof = {
    protocol: "SliverVine",
    engine: "v1.0 Santenmoku",
    exportedAt: new Date().toISOString(),
    batchId: batch.id,
    sha256Anchor: computeVerified5TxSha256Anchor(batch.results.fills),
    fillHashes: batch.results.fills.map((f) => f.txHash),
    sessionKey: batch.results.wallet,
    soilResistanceLogs: [...soilLogs],
  };
  const blob = new Blob([JSON.stringify(proof, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "silvervine_tca_audit_proof.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
