import { DEFAULT_TAIL_HEDGE_THRESHOLD, evaluateTailHedgeTrigger } from "../core/tail-hedge-gate";
import {
  R20_LOCKED,
  isR20Locked,
  readActiveSystemState,
  type CoreSystemState,
} from "../core/state";
import { isHedgeActive } from "../core/risk";
import { CORS_JSON_HEADERS } from "../services/config";
import type { SoilResistanceInput } from "../services/risk-control";

export interface StateApiResponse {
  success: true;
  systemState: CoreSystemState;
}

export interface HedgeEvaluateRequestBody {
  marketPrice: number;
  thresholdProb?: number;
  soil?: SoilResistanceInput;
}

export interface HedgeEvaluateSuccessResponse {
  success: true;
  triggered: boolean;
  marketPrice: number;
  thresholdProb: number;
  isHedgeActive: boolean;
  systemState: CoreSystemState;
}

export interface HedgeEvaluateErrorResponse {
  success: false;
  error: string;
  code?: string;
  isHedgeActive?: boolean;
  systemState?: CoreSystemState;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_JSON_HEADERS,
  });
}

/** GET /api/state — authoritative CoreSystemState snapshot */
export function handleStateRequest(): Response {
  const body: StateApiResponse = {
    success: true,
    systemState: readActiveSystemState(),
  };
  return json(body, 200);
}

/** POST /api/hedge/evaluate — Pgate-gated tail hedge trigger evaluation */
export async function handleHedgeEvaluateRequest(
  request: Request,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const input = body as HedgeEvaluateRequestBody;
  const marketPrice = Number(input.marketPrice);
  const thresholdProb = Number(
    input.thresholdProb ?? DEFAULT_TAIL_HEDGE_THRESHOLD,
  );

  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || marketPrice > 1) {
    return json({ success: false, error: "Invalid marketPrice" }, 422);
  }

  if (
    !Number.isFinite(thresholdProb) ||
    thresholdProb <= 0 ||
    thresholdProb > 1
  ) {
    return json({ success: false, error: "Invalid thresholdProb" }, 422);
  }

  const systemState = readActiveSystemState();

  if (isR20Locked(systemState)) {
    const err: HedgeEvaluateErrorResponse = {
      success: false,
      code: R20_LOCKED,
      error: "Hedge evaluation blocked — signing channel severed",
      systemState,
    };
    return json(err, 403);
  }

  if (input.soil) {
    const hedgeActive = isHedgeActive(input.soil, systemState);
    if (!hedgeActive) {
      const err: HedgeEvaluateErrorResponse = {
        success: false,
        code: "SOIL_RESISTANCE_TRIP",
        error: "Soil resistance tripped — hedge channel inactive",
        isHedgeActive: false,
        systemState,
      };
      return json(err, 422);
    }
  }

  const triggered = evaluateTailHedgeTrigger(marketPrice, thresholdProb);
  const hedgeActive = input.soil
    ? isHedgeActive(input.soil, systemState)
    : systemState.isHedgeActive;

  const ok: HedgeEvaluateSuccessResponse = {
    success: true,
    triggered,
    marketPrice,
    thresholdProb,
    isHedgeActive: hedgeActive,
    systemState,
  };

  return json(ok, 200);
}

/** Dispatch Phase 2 index routes; returns null when unmatched. */
export async function handleIndexApiRequest(
  request: Request,
  url: URL,
): Promise<Response | null> {
  if (url.pathname === "/api/state" && request.method === "GET") {
    return handleStateRequest();
  }

  if (url.pathname === "/api/hedge/evaluate" && request.method === "POST") {
    return handleHedgeEvaluateRequest(request);
  }

  return null;
}
