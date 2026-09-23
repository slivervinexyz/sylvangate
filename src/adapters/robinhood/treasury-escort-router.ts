/**
 * Institutional Treasury Escort Router (Pillar Set X · Component 2 decision layer).
 * Treasury Escort & Collateral Ingress: Robinhood (46630/4663) → Arbitrum One GM pools
 * via unidirectional bridge. Contracts remain undeployed; routing decisions are fail-closed and testable.
 */
import {
  ARBITRUM_ONE_CHAIN_ID,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../../sdk/constants";
import { assertUnidirectionalBridge } from "../../sdk/unidirectional-bridge";
import { IN_FLIGHT_BRIDGE_CAPITAL } from "../across-ingress-bridge";
import {
  type GmPoolRouteKey,
  normalizeV1ExecutionRoute,
  resolveGmxMarketForExecution,
} from "../../config/gmx-markets";
import {
  DEFAULT_SMART_ROUTE_SOURCE_CHAIN_ID,
  GMX_V2_EXCHANGE_ROUTER_ARBITRUM,
  resolveZeroDevSmartRouteTarget,
} from "../../config/gmx-revenue";
import {
  buildDeterministicRouteId,
  buildRChainExecutionProbe,
  type RChainYieldAssetKind,
  type RChainYieldRouteInput,
} from "./treasury-escort-stub";

export const GM_POOL_TARGET_DEFAULT = "GM_ETH_USDC" as const;
export const RWA_YIELD_MIN_USD = 10 as const;
export const RWA_YIELD_MAX_USD = 250_000 as const;

export interface RChainYieldEscortInput extends RChainYieldRouteInput {
  wallet: string;
  sourceChainId?: number;
  /** @deprecated use targetRoute */
  gmPoolTarget?: string;
  targetRoute?: GmPoolRouteKey;
  initiatedAtMs?: number;
  settledAtMs?: number | null;
  nowMs?: number;
}

export interface RChainYieldEscortQuote {
  ok: boolean;
  reasons: string[];
  sourceChainId: number;
  destChainId: typeof ARBITRUM_ONE_CHAIN_ID;
  assetKind: RChainYieldAssetKind;
  symbol: string;
  amountUsd: number;
  expectedApyBps: number;
  routeId: string;
  gmPoolTarget: string;
  targetRoute: GmPoolRouteKey;
  smartRoutingAddress: `0x${string}`;
  destMarketToken: `0x${string}`;
  bridgeEscortOk: boolean;
  /** Decision layer is live; on-chain yield vault still undeployed. */
  decisionReady: true;
  contractDeployed: false;
  expiresAtMs: number;
}

const APY_BPS: Record<RChainYieldAssetKind, number> = { rwa: 450, idle: 320 };
const ROUTE_TTL_MS = 300_000;

function resolveSourceChainId(chainId?: number): number | null {
  if (chainId === undefined) return DEFAULT_SMART_ROUTE_SOURCE_CHAIN_ID;
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID || chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    return chainId;
  }
  return null;
}

/** Institutional treasury escort quote: size gates + unidirectional bridge + GM destination. */
export function quoteRChainYieldToArbitrumGm(
  input: RChainYieldEscortInput,
): RChainYieldEscortQuote {
  const nowMs = input.nowMs ?? Date.now();
  const resolvedSource = resolveSourceChainId(input.sourceChainId);
  const sourceChainId = resolvedSource ?? DEFAULT_SMART_ROUTE_SOURCE_CHAIN_ID;
  const smartRoute = resolvedSource !== null ? resolveZeroDevSmartRouteTarget(sourceChainId) : null;
  const targetRoute = normalizeV1ExecutionRoute(
    input.targetRoute ??
      (input.gmPoolTarget as GmPoolRouteKey | undefined) ??
      smartRoute?.gmPoolRouteKey ??
      GM_POOL_TARGET_DEFAULT,
  );
  const gmPoolTarget = targetRoute;
  const market = resolveGmxMarketForExecution(targetRoute);
  const smartRoutingAddress = smartRoute?.smartRoutingAddress ?? GMX_V2_EXCHANGE_ROUTER_ARBITRUM;
  const reasons: string[] = [];
  if (resolvedSource === null) reasons.push("RWA_YIELD_SOURCE_CHAIN_UNSUPPORTED");
  if (!(input.amountUsd >= RWA_YIELD_MIN_USD)) reasons.push("RWA_YIELD_AMOUNT_TOO_SMALL");
  if (input.amountUsd > RWA_YIELD_MAX_USD) reasons.push("RWA_YIELD_AMOUNT_TOO_LARGE");
  if (!input.symbol?.trim()) reasons.push("RWA_YIELD_SYMBOL_REQUIRED");

  let bridgeEscortOk = false;
  if (resolvedSource !== null) {
    const bridge = assertUnidirectionalBridge({
      sourceChainId,
      destChainId: ARBITRUM_ONE_CHAIN_ID,
      amountUsd: input.amountUsd,
      wallet: input.wallet,
      initiatedAtMs: input.initiatedAtMs ?? nowMs,
      settledAtMs: input.settledAtMs,
      nowMs,
    });
    bridgeEscortOk = bridge.deployable;
    if (!bridge.routeAllowed) reasons.push(...bridge.reasons);
    else if (!bridge.deployable && bridge.capitalLabel === IN_FLIGHT_BRIDGE_CAPITAL) {
      reasons.push(IN_FLIGHT_BRIDGE_CAPITAL);
    }
  }

  const routeId = buildDeterministicRouteId({
    assetKind: input.assetKind,
    symbol: input.symbol,
    amountUsd: input.amountUsd,
    vaultId: input.vaultId ?? gmPoolTarget,
  });

  return {
    ok: reasons.length === 0,
    reasons,
    sourceChainId,
    destChainId: ARBITRUM_ONE_CHAIN_ID,
    assetKind: input.assetKind,
    symbol: input.symbol,
    amountUsd: input.amountUsd,
    expectedApyBps: APY_BPS[input.assetKind],
    routeId,
    gmPoolTarget,
    targetRoute,
    smartRoutingAddress,
    destMarketToken: market.marketToken,
    bridgeEscortOk,
    decisionReady: true,
    contractDeployed: false,
    expiresAtMs: nowMs + ROUTE_TTL_MS,
  };
}

export async function buildRChainYieldEscortProbe(input: RChainYieldEscortInput) {
  const quote = quoteRChainYieldToArbitrumGm(input);
  const probe = await buildRChainExecutionProbe(
    {
      assetKind: input.assetKind,
      symbol: input.symbol,
      amountUsd: input.amountUsd,
      vaultId: quote.gmPoolTarget,
    },
    input.nowMs ?? Date.now(),
  );
  return { quote, probe };
}
