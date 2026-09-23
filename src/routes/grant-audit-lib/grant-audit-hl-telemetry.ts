/** Grant audit — aggregated HL wallet telemetry for UI binding. */
import { buildDualWalletTelemetryMetrics } from "../../services/dual-wallet-telemetry";
import type { HlTelemetryMetrics } from "./grant-audit.types";

export function buildGrantAuditHlTelemetry(): HlTelemetryMetrics {
  const dual = buildDualWalletTelemetryMetrics();
  const walletA = dual.walletA?.totalUsd ?? 0;
  const walletB = dual.walletB?.totalUsd ?? 0;
  return {
    totalUsd: walletA + walletB,
    walletAHlTotalUsd: dual.walletA?.totalUsd ?? null,
    walletBHlTotalUsd: dual.walletB?.totalUsd ?? null,
    fetchedAt: dual.fetchedAt,
  };
}
