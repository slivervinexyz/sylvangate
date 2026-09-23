/**
 * Pendle Yield Shield API — REST/JSON interfaces (Option 2 + Option 3).
 * Powered by Wasm soil cores via checkSoilResistance and intent-core u32 ring.
 */
import type { AgenticRollParams } from "./agentic-auto-roll-gate";
import { evaluateAgenticAutoRollGate } from "./agentic-auto-roll-gate";
import type { CrossVenueShadowMarginInput } from "./shadow-margin-guard";
import { evaluateCrossVenueShadowMargin } from "./shadow-margin-guard";
import { PENDLE_SHIELD_API } from "./pendle-shield-paths";

export {
  evaluateCrossVenueShadowMargin,
  SHADOW_MARGIN_HL_STRESS_FAIL_BPS,
  type CrossVenueShadowMarginInput,
  type CrossVenueShadowMarginResult,
  type HLHedgePositionState,
} from "./shadow-margin-guard";

export {
  evaluateAgenticAutoRollGate,
  PENDLE_ROLL_ACTIONS,
  ROLL_GATE_CODES,
  __resetAgenticRollGateForTests,
  type AgenticRollParams,
  type AgenticRollVerdict,
  type PendleRollAction,
} from "./agentic-auto-roll-gate";

export {
  sinkErc7710IntentOnSoilTrip,
  type Permit2ExpiryIntent,
  type Erc7710CancellationSignal,
  type Erc7710ExpiryVerdict,
} from "./erc7710-intent-expiry";

export { PENDLE_SHIELD_API, isPendleShieldApiPath } from "./pendle-shield-paths";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

function badRequest(error: string, detail?: unknown): Response {
  return Response.json({ ok: false, error, detail }, { status: 400, headers: JSON_HEADERS });
}

/** POST /api/pendle-shield/shadow-margin — cross-venue shadow margin evaluation. */
export async function handleShadowMarginGuardRequest(
  request: Request,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: CrossVenueShadowMarginInput;
  try {
    body = (await request.json()) as CrossVenueShadowMarginInput;
  } catch {
    return badRequest("INVALID_JSON");
  }
  if (!body?.marketKeyOrAddress || !body?.gmxPos) {
    return badRequest("MARKET_AND_GMX_POS_REQUIRED");
  }

  const result = evaluateCrossVenueShadowMargin(body);
  return Response.json(
    { ok: true, api: "pendle-shield/shadow-margin", option: 2, result },
    { headers: JSON_HEADERS },
  );
}

/** POST /api/pendle-shield/auto-roll — agentic PT/YT roll pre-consensus gate. */
export async function handleAgenticAutoRollGateRequest(
  request: Request,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: AgenticRollParams;
  try {
    body = (await request.json()) as AgenticRollParams;
  } catch {
    return badRequest("INVALID_JSON");
  }
  if (!body?.agentId || !body?.action || !body?.sourceMarketKeyOrAddress) {
    return badRequest("AGENT_ROLL_FIELDS_REQUIRED");
  }

  const verdict = evaluateAgenticAutoRollGate(body);
  const status = verdict.passed ? 200 : 422;
  return Response.json(
    { ok: verdict.passed, api: "pendle-shield/auto-roll", option: 3, verdict },
    { status, headers: JSON_HEADERS },
  );
}

/** Route dispatcher for Pendle Yield Shield endpoints. */
export async function handlePendleShieldRequest(
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === PENDLE_SHIELD_API.shadowMargin) {
    return handleShadowMarginGuardRequest(request);
  }
  if (url.pathname === PENDLE_SHIELD_API.autoRoll) {
    return handleAgenticAutoRollGateRequest(request);
  }
  return new Response("Not Found", { status: 404 });
}
