/** Deposit → checkSoilResistance → GatedExecutor payloadHash preview (SPA-only, no EIP-712 change). */
import { quoteRChainYieldToArbitrumGm, RWA_YIELD_MIN_USD } from "../../../adapters/robinhood/treasury-escort-router";
import {
  type GmPoolRouteKey,
  normalizeV1ExecutionRoute,
  resolveGmxMarketForExecution,
} from "../../../config/gmx-markets";
import { ARBITRUM_ONE_CHAIN_ID, SLIVERVINE_GATE_ADDRESS } from "../../../sdk/constants";
import { checkSoilResistance } from "../../../services/risk-control";
import { buildGmxSmartRoutePayloadBinding } from "../../../services/adapters/gmx-smart-route-payload-binding";
import { buildGmxV2UnsignedOrderPayload } from "../../../services/adapters/gmx-v2-order-payload";
import type { DepositTrancheId } from "../deposit-tranche-config";

export type SmartRouteDepositPhase = "idle" | "soil" | "gate" | "ready" | "blocked";

export interface SmartRouteDepositPreview {
  phase: SmartRouteDepositPhase;
  ok: boolean;
  reasons: string[];
  targetRoute: GmPoolRouteKey;
  smartRoutingAddress: string;
  payloadHash: string | null;
  soilTripped: boolean;
  gateSimVerdict: "ALLOW" | "DENY" | null;
}

function buildReadyPreview(input: {
  amountUsd: number;
  wallet: `0x${string}`;
  targetRoute: GmPoolRouteKey;
  sourceChainId: number;
  smartRoutingAddress: string;
}): SmartRouteDepositPreview {
  const targetRoute = normalizeV1ExecutionRoute(input.targetRoute);
  const soil = checkSoilResistance({
    symbol: "ETH",
    hlSpot: 3200,
    hlPerp: 3200.5,
    dydxPerp: 3200.2,
    depthUsd: 200_000,
    orderSizeUsd: input.amountUsd,
    accountBalanceUsd: 50_000,
  });
  if (soil.tripped) {
    return {
      phase: "blocked",
      ok: false,
      reasons: soil.reasons,
      targetRoute,
      smartRoutingAddress: input.smartRoutingAddress,
      payloadHash: null,
      soilTripped: true,
      gateSimVerdict: "DENY",
    };
  }
  const market = resolveGmxMarketForExecution(targetRoute);
  const order = buildGmxV2UnsignedOrderPayload({
    side: "long",
    sizeUsd: input.amountUsd,
    midPriceUsd: 3_200,
    marketToken: market.marketToken,
    maxSlippageBps: 30,
  });
  const binding = buildGmxSmartRoutePayloadBinding({
    sourceChainId: input.sourceChainId,
    executor: SLIVERVINE_GATE_ADDRESS,
    initiator: input.wallet,
    nonce: BigInt(Date.now()),
    orderPayload: order,
    targetRoute,
  });
  return {
    phase: "ready",
    ok: true,
    reasons: [],
    targetRoute,
    smartRoutingAddress: input.smartRoutingAddress,
    payloadHash: binding.payloadHash,
    soilTripped: false,
    gateSimVerdict: "ALLOW",
  };
}

/** Tranche A — instant Arbitrum One USDC → GMX GM vault path (no bridge state machine). */
export function runArbitrumNativeDepositPreview(input: {
  amountUsd: number;
  wallet: `0x${string}`;
  targetRoute?: GmPoolRouteKey;
}): SmartRouteDepositPreview {
  const targetRoute = normalizeV1ExecutionRoute(input.targetRoute);
  if (!(input.amountUsd >= RWA_YIELD_MIN_USD)) {
    return {
      phase: "blocked",
      ok: false,
      reasons: [`MIN_DEPOSIT:${RWA_YIELD_MIN_USD}USD`],
      targetRoute,
      smartRoutingAddress: SLIVERVINE_GATE_ADDRESS,
      payloadHash: null,
      soilTripped: false,
      gateSimVerdict: "DENY",
    };
  }
  return buildReadyPreview({
    amountUsd: input.amountUsd,
    wallet: input.wallet,
    targetRoute,
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    smartRoutingAddress: SLIVERVINE_GATE_ADDRESS,
  });
}

export function runDepositPreviewByTranche(input: {
  tranche: DepositTrancheId;
  amountUsd: number;
  wallet: `0x${string}`;
  targetRoute?: GmPoolRouteKey;
}): SmartRouteDepositPreview {
  if (input.tranche === "tranche-a-native") {
    return runArbitrumNativeDepositPreview({
      amountUsd: input.amountUsd,
      wallet: input.wallet,
      targetRoute: input.targetRoute,
    });
  }
  return runSmartRouteDepositPreview({
    amountUsd: input.amountUsd,
    wallet: input.wallet,
    targetRoute: input.targetRoute,
  });
}

export function runSmartRouteDepositPreview(input: {
  amountUsd: number;
  symbol?: string;
  wallet: `0x${string}`;
  targetRoute?: GmPoolRouteKey;
  initiatedAtMs?: number;
  settledAtMs?: number | null;
  nowMs?: number;
}): SmartRouteDepositPreview {
  const nowMs = input.nowMs ?? Date.now();
  const initiatedAtMs = input.initiatedAtMs ?? nowMs - 120_000;
  const settledAtMs =
    input.settledAtMs === undefined ? initiatedAtMs + 60_000 : input.settledAtMs;
  const quote = quoteRChainYieldToArbitrumGm({
    assetKind: "idle",
    symbol: input.symbol ?? "USDG",
    amountUsd: input.amountUsd,
    wallet: input.wallet,
    targetRoute: input.targetRoute,
    initiatedAtMs,
    settledAtMs,
    nowMs,
  });
  if (!quote.ok || !quote.bridgeEscortOk) {
    return {
      phase: "blocked",
      ok: false,
      reasons: quote.reasons,
      targetRoute: quote.targetRoute,
      smartRoutingAddress: quote.smartRoutingAddress,
      payloadHash: null,
      soilTripped: false,
      gateSimVerdict: "DENY",
    };
  }
  return buildReadyPreview({
    amountUsd: input.amountUsd,
    wallet: input.wallet,
    targetRoute: quote.targetRoute,
    sourceChainId: quote.sourceChainId,
    smartRoutingAddress: quote.smartRoutingAddress,
  });
}
