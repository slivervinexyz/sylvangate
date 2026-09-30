import {
  evaluateBridgeTimeout,
  validateAcrossBridgeDirection,
} from "../../../src/adapters/across-ingress-bridge";
import { quoteRChainYieldToArbitrumGm } from "../../../src/adapters/robinhood/treasury-escort-router";
import {
  evaluateAgentExoMeshGuard,
  guardAgentUserOp,
} from "../../../src/core/agent-exomesh-guard";
import { evaluateGatewayRules } from "../../../src/core/risk-engine-gateway-rules";
import { checkAirlockThreshold } from "../../../src/core/risk-engine-airlock";
import type { AirlockThresholdInput } from "../../../src/core/airlock-threshold-types";

export type CorpusEntryName =
  | "guardAgentUserOp"
  | "checkAirlockThreshold"
  | "evaluateGatewayRules"
  | "validateAcrossBridgeDirection"
  | "evaluateBridgeTimeout"
  | "quoteRChainYieldToArbitrumGm"
  | "evaluateAgentExoMeshGuard";

export interface CorpusExpect {
  allowed?: boolean;
  tripped?: boolean;
  ok?: boolean;
  failClosed?: boolean;
  inboundBlocked?: boolean;
  bridgeEscortOk?: boolean;
  deadmanTriggered?: boolean;
  reasonIncludes?: string;
}

export interface CorpusCase {
  id: string;
  entry: CorpusEntryName;
  input: Record<string, unknown>;
  expect: CorpusExpect;
}

function hydrateAirlock(raw: Record<string, unknown>): AirlockThresholdInput {
  const soil = { ...raw } as AirlockThresholdInput & { at?: string | Date };
  if (typeof soil.at === "string") soil.at = new Date(soil.at);
  return soil;
}

export async function runCorpusCase(caseDef: CorpusCase): Promise<Record<string, unknown>> {
  const input = caseDef.input;
  switch (caseDef.entry) {
    case "guardAgentUserOp":
      return await guardAgentUserOp({
        intent: input.intent as Parameters<typeof guardAgentUserOp>[0]["intent"],
        airlock: hydrateAirlock(input.airlock as Record<string, unknown>),
        atMs: input.atMs as number | undefined,
      });
    case "evaluateAgentExoMeshGuard": {
      const verdict = evaluateAgentExoMeshGuard({
        intent: input.intent as Parameters<typeof evaluateAgentExoMeshGuard>[0]["intent"],
        airlock: hydrateAirlock(input.airlock as Record<string, unknown>),
        atMs: input.atMs as number | undefined,
      });
      return {
        allowed: verdict.allowed,
        deadmanTriggered: verdict.rejectPayload?.deadmanTriggered ?? false,
      };
    }
    case "checkAirlockThreshold":
      return checkAirlockThreshold(hydrateAirlock(input as Record<string, unknown>));
    case "evaluateGatewayRules":
      return evaluateGatewayRules({
        symbol: input.symbol as string,
        payloadPoison: input.payloadPoison as boolean | undefined,
        airlock: hydrateAirlock(input.airlock as Record<string, unknown>),
      });
    case "validateAcrossBridgeDirection":
      return validateAcrossBridgeDirection({
        sourceChainId: input.sourceChainId as number,
        destChainId: input.destChainId as number,
      });
    case "evaluateBridgeTimeout":
      return evaluateBridgeTimeout(input.initiatedAtMs as number, input.nowMs as number);
    case "quoteRChainYieldToArbitrumGm":
      return quoteRChainYieldToArbitrumGm(
        input as Parameters<typeof quoteRChainYieldToArbitrumGm>[0],
      );
    default:
      throw new Error(`unsupported corpus entry: ${caseDef.entry}`);
  }
}

export function assertCorpusExpect(
  result: Record<string, unknown>,
  expect: CorpusExpect,
  caseId: string,
): void {
  for (const [key, value] of Object.entries(expect)) {
    if (key === "reasonIncludes") {
      const reasons = (result.reasons as string[] | undefined) ?? [];
      const haystack = reasons.join(" ");
      if (!haystack.includes(value as string)) {
        throw new Error(`${caseId}: expected reason to include ${value}`);
      }
      continue;
    }
    if (result[key] !== value) {
      throw new Error(`${caseId}: expected ${key}=${value} got ${result[key]}`);
    }
  }
}
