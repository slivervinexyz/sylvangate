/**
 * ZeroDev AA smoke audit artifact — SSOT builder for docs/audit/zerodev-aa-metrics.json.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZeroDevAAEnvConfig } from "../src/adapters/arbitrum/zerodev-aa/zerodev-aa-types";
import type { ZeroDevSmokeReport } from "../src/adapters/arbitrum/zerodev-aa/zerodev-aa-types";
import { resolveAuditArtifactBinding, type AuditArtifactBinding } from "./audit-artifact-bindings";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const ZERODEV_AA_METRICS_PATH = join(ROOT, "docs/audit/zerodev-aa-metrics.json");

export type ZeroDevBundlerStatus = "REACHABLE" | "UNREACHABLE" | "DRY_RUN" | "DISABLED";

export interface ZeroDevAaMetricsArtifact extends AuditArtifactBinding {
  featureFlag: boolean;
  projectId: string | null;
  kernelAddress: string | null;
  bundlerStatus: ZeroDevBundlerStatus;
  paymasterSponsored: boolean;
  paymasterAttached: boolean;
  multichainProbes?: Array<{
    chainId: number;
    label: string;
    bundlerStatus: ZeroDevBundlerStatus;
    paymasterSponsored: boolean;
    paymasterAttached: boolean;
  }>;
  noPrivateKeyMaterialDetected: boolean;
  isolationVerified: boolean;
}

export function resolveBundlerStatus(
  report: ZeroDevSmokeReport,
  live: boolean,
): ZeroDevBundlerStatus {
  if (!report.enabled) return "DISABLED";
  if (!live) return "DRY_RUN";
  if (report.bundlerReachable) return "REACHABLE";
  return "UNREACHABLE";
}

export function detectPrivateKeyMaterial(
  artifact: Omit<ZeroDevAaMetricsArtifact, "noPrivateKeyMaterialDetected">,
): boolean {
  const blob = JSON.stringify(artifact);
  if (/ownerPrivateKey|ARB_MAINNET_SESSION_PK/i.test(blob)) return true;
  return (blob.match(/0x[a-fA-F0-9]{64}/g) ?? []).length > 0;
}

export function buildZeroDevAaMetrics(
  report: ZeroDevSmokeReport,
  live: boolean,
  config: ZeroDevAAEnvConfig | null,
  at: Date = new Date(),
): ZeroDevAaMetricsArtifact {
  const binding = resolveAuditArtifactBinding(at);
  const bundlerStatus = resolveBundlerStatus(report, live);
  const isolationVerified =
    (!report.enabled && report.errors.length === 0) ||
    (report.enabled &&
      report.errors.length === 0 &&
      (!live || report.bundlerReachable === true));

  const draft: Omit<ZeroDevAaMetricsArtifact, "noPrivateKeyMaterialDetected"> = {
    ...binding,
    featureFlag: report.enabled,
    projectId: config?.projectId ?? null,
    kernelAddress: report.smartAccountAddress ?? null,
    bundlerStatus,
    paymasterSponsored: report.sponsored ?? true,
    paymasterAttached: report.paymasterAttached ?? false,
    multichainProbes: report.multichainProbes?.map((p) => ({
      chainId: p.chainId,
      label: p.label,
      bundlerStatus: p.bundlerStatus as ZeroDevBundlerStatus,
      paymasterSponsored: p.sponsored,
      paymasterAttached: p.paymasterAttached,
    })),
    isolationVerified,
  };

  return {
    ...draft,
    noPrivateKeyMaterialDetected: !detectPrivateKeyMaterial(draft),
  };
}

export function writeZeroDevAaMetrics(
  artifact: ZeroDevAaMetricsArtifact,
  path: string = ZERODEV_AA_METRICS_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
}
