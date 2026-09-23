/** Grant audit — Zero-Trust payload assembly from KV + live guard caches. */
import type { Env } from "../../env";
import { resolveGrantAuditEnv } from "../../env-grant-defaults";
import { buildEscalationStateForLogs } from "../../services/risk/escalation-logs";
import { engineModeForGrantAudit } from "../../middleware/engine-mode-router";
import { attachExomeshFields, attachGrantAuditExtensions } from "./grant-audit-attach";
import { resolveGrantAuditBlockProofs } from "./grant-audit-block-proofs";
import { buildArbitrumExomeshRiskMetrics } from "./grant-audit-exomesh-metrics";
import { ensureGrantAuditGuardsFresh } from "./grant-audit-guard-refresh";
import { buildGrantAuditHlTelemetry } from "./grant-audit-hl-telemetry";
import {
  collectGrantAuditEntries,
  extractGrantAuditExomeshMetrics,
  GRANT_AUDIT_HISTORY_KEY,
  GRANT_AUDIT_LATEST_KEY,
  readGrantAuditKvJson,
} from "./grant-audit-kv";
import { attachProvenanceVerifiedTrades } from "./grant-audit-provenance";
import type { GrantAuditPayload } from "./grant-audit.types";
import { buildGrantAuditSwrFallbackPayload } from "./grant-audit-swr-fallback";
import { attachSepoliaDualLegProof } from "./grant-audit-v0-telemetry-fallback";
import { extractTxHashes, proveZeroDelta } from "./grant-audit-zero-delta";
import { buildZeroDevAaGatewayStatus } from "./grant-audit-zerodev-aa";
import { buildGrantAuditDuneTelemetry } from "./grant-audit-dune-telemetry";
import { GRANT_AUDIT_SSOT_LOCK } from "./grant-audit-ssot-lock";

/** Build Zero-Trust grant audit JSON from EXECUTION_LOGS_KV. */
export async function buildGrantAuditPayload(
  env: Env,
  request?: Request | null,
): Promise<GrantAuditPayload> {
  try {
    const fetchedAt = new Date().toISOString();
    const engineMode = engineModeForGrantAudit(request);
    const nowMs = Date.parse(fetchedAt);
    const grantEnv = resolveGrantAuditEnv(env);
    const kv = env.EXECUTION_LOGS_KV;

    if (!kv) {
      void ensureGrantAuditGuardsFresh(grantEnv, nowMs).catch(() => {});
      return buildGrantAuditSwrFallbackPayload(request, "EXECUTION_LOGS_KV binding missing", env);
    }

    try {
      void ensureGrantAuditGuardsFresh(grantEnv, nowMs).catch(() => {});
    } catch {
      // Guard refresh fail-soft — cached SWR metrics remain available.
    }

    let exomeshMetrics;
    let hlTelemetry;
    try {
      exomeshMetrics = buildArbitrumExomeshRiskMetrics(grantEnv);
      hlTelemetry = buildGrantAuditHlTelemetry();
    } catch (error) {
      const message = error instanceof Error ? error.message : "ExoMesh metrics build failed";
      return buildGrantAuditSwrFallbackPayload(request, message, env);
    }

    let latest: unknown;
    let history: unknown;
    try {
      [latest, history] = await Promise.all([
        readGrantAuditKvJson(kv, GRANT_AUDIT_LATEST_KEY),
        readGrantAuditKvJson(kv, GRANT_AUDIT_HISTORY_KEY),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "EXECUTION_LOGS_KV read failed";
      return buildGrantAuditSwrFallbackPayload(request, message, env);
    }

    const executionHistory = collectGrantAuditEntries(history, latest);
    const txHashes = extractTxHashes(executionHistory);
    const zeroDelta = proveZeroDelta(executionHistory);
    const escalationState = buildEscalationStateForLogs(latest);

    let blockProofs;
    try {
      blockProofs = await resolveGrantAuditBlockProofs({
        entries: executionHistory,
        latest,
        txHashes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Block proof resolution failed";
      return buildGrantAuditSwrFallbackPayload(request, message, env);
    }

    return attachProvenanceVerifiedTrades(attachSepoliaDualLegProof({
      success: true,
      audit: "ZERO_TRUST_GRANT",
      exomesh: extractGrantAuditExomeshMetrics(latest),
      zeroDelta,
      txHashes,
      executionHistory,
      latest,
      history,
      escalationState,
      ...blockProofs,
      ...attachExomeshFields(exomeshMetrics, executionHistory),
      hlTelemetry,
      ...attachGrantAuditExtensions({
        l1BlockHash: blockProofs.l1BlockHash,
        fundingEpochBlockHeight: blockProofs.fundingEpochBlockHeight,
        txHashes,
        env: grantEnv,
      }),
      engineMode,
      fetchedAt,
      zeroDevAaGateway: buildZeroDevAaGatewayStatus(env),
      duneTelemetry: buildGrantAuditDuneTelemetry(fetchedAt),
      ssotLock: GRANT_AUDIT_SSOT_LOCK,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grant audit assembly failed";
    return buildGrantAuditSwrFallbackPayload(request, message, env);
  }
}
