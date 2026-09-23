/** Gateway soil + vine wrap orchestration — fail-closed SSOT. */
import { HardlockError, RiskLimitExceeded } from "./errors";
import { vineWrapProtection } from "./root-protection-core";
import type { ExoMeshRiskGateVerdict, GatewayRulesInput, GatewayRulesResult } from "./risk-engine-lib/risk-engine-types";
import { checkSoilResistance, isGatewayNominalFastPath } from "./risk-engine-soil";
import { logRiskCore } from "./core-telemetry";

const GATEWAY_CLEAR: GatewayRulesResult = Object.freeze({
  blocked: false,
  tripped: false,
  crashed: false,
  failClosed: false,
  reasons: Object.freeze([]),
});
const PAYLOAD_POISON: GatewayRulesResult = Object.freeze({
  blocked: true,
  tripped: true,
  crashed: false,
  failClosed: true,
  reasons: Object.freeze(["PAYLOAD_POISON_FAIL_CLOSED"]),
});

export function evaluateGatewayRules(input: GatewayRulesInput): GatewayRulesResult {
  if (input.payloadPoison) {
    logRiskCore("payload poison fail-closed");
    return PAYLOAD_POISON;
  }
  const hasVine = input.estimatedLossUsd !== undefined && input.accountBalanceUsd !== undefined;
  if (!hasVine && isGatewayNominalFastPath(input.soil)) return GATEWAY_CLEAR;
  try {
    const soil = checkSoilResistance(input.soil);
    if (!soil.tripped) {
      if (!hasVine) return GATEWAY_CLEAR;
      vineWrapProtection({
        symbol: input.symbol,
        estimatedLossUsd: input.estimatedLossUsd!,
        accountBalanceUsd: input.accountBalanceUsd!,
        criHardlock: input.criHardlock,
      });
      return GATEWAY_CLEAR;
    }
    logRiskCore("soil trip", { symbol: input.symbol, reasons: soil.reasons });
    return { blocked: true, tripped: true, crashed: false, failClosed: true, reasons: soil.reasons };
  } catch (err) {
    if (err instanceof HardlockError || err instanceof RiskLimitExceeded) {
      logRiskCore("hardlock/risk limit", { code: err.code });
      return {
        blocked: true,
        tripped: true,
        crashed: false,
        failClosed: true,
        reasons: Object.freeze([err.code]),
        errorCode: err.code,
      };
    }
    logRiskCore("gateway crash", { err: err instanceof Error ? err.message : String(err) });
    return {
      blocked: true,
      tripped: true,
      crashed: true,
      failClosed: false,
      reasons: Object.freeze([err instanceof Error ? err.message : String(err)]),
    };
  }
}

export function assertExoMeshRiskGate(input: GatewayRulesInput, expectTrip: boolean): ExoMeshRiskGateVerdict {
  const result = evaluateGatewayRules(input);
  if (!expectTrip) return { pass: !result.tripped, failClosed: false, falseNegatives: 0, result };
  const failClosed = result.failClosed && result.tripped;
  return { pass: failClosed, failClosed, falseNegatives: result.tripped ? 0 : 1, result };
}
