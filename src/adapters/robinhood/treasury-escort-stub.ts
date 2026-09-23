/** Institutional Treasury Escort Router stub (Robinhood Testnet · Treasury Escort & Collateral Ingress · no bridge deploy). */

import { ROBINHOOD_TESTNET_CHAIN_ID } from "../../sdk/constants";

export { ROBINHOOD_TESTNET_CHAIN_ID };
export const R_CHAIN_ZERODEV_PROJECT_ID = "e93db466-d580-4e15-9cc1-ce50f1541ca2" as const;
export const R_CHAIN_ZERODEV_BUNDLER_RPC =
  `https://rpc.zerodev.app/api/v3/${R_CHAIN_ZERODEV_PROJECT_ID}/chain/${ROBINHOOD_TESTNET_CHAIN_ID}` as const;

export const R_CHAIN_STUB_DOMAIN_NAME = "SliverVineRChainIdleYield" as const;
export const R_CHAIN_STUB_DOMAIN_VERSION = "0.1" as const;
export const R_CHAIN_STUB_VERIFYING_CONTRACT = "0x0000000000000000000000000000000000000000" as const;

export type RChainYieldAssetKind = "rwa" | "idle";

export interface RChainYieldRouteInput {
  assetKind: RChainYieldAssetKind;
  symbol: string;
  amountUsd: number;
  vaultId?: string;
}

export interface RChainYieldRouteQuote {
  chainId: typeof ROBINHOOD_TESTNET_CHAIN_ID;
  assetKind: RChainYieldAssetKind;
  symbol: string;
  amountUsd: number;
  expectedApyBps: number;
  routeId: string;
  vaultId: string | null;
  stubOnly: true;
  expiresAtMs: number;
}

export interface RChainEip712IdleYieldProbe {
  domain: {
    name: typeof R_CHAIN_STUB_DOMAIN_NAME;
    version: typeof R_CHAIN_STUB_DOMAIN_VERSION;
    chainId: typeof ROBINHOOD_TESTNET_CHAIN_ID;
    verifyingContract: typeof R_CHAIN_STUB_VERIFYING_CONTRACT;
  };
  types: {
    IdleYieldRoute: [
      { name: "assetKind"; type: "string" },
      { name: "symbol"; type: "string" },
      { name: "amountUsd"; type: "uint256" },
      { name: "routeId"; type: "bytes32" },
      { name: "nonce"; type: "uint256" },
    ];
  };
  message: {
    assetKind: RChainYieldAssetKind;
    symbol: string;
    amountUsd: number;
    routeId: string;
    nonce: number;
  };
}

export interface RChainExecutionProbeResult {
  chainId: typeof ROBINHOOD_TESTNET_CHAIN_ID;
  routeId: string;
  eip712: RChainEip712IdleYieldProbe;
  digestStub: string;
  stubOnly: true;
  bridgeDeployed: false;
  contractDeployed: false;
}

/** Treasury Escort & Collateral Ingress routing contract — stub implementation only. */
export interface IRChainYieldRouter {
  readonly chainId: typeof ROBINHOOD_TESTNET_CHAIN_ID;
  quoteRoute(input: RChainYieldRouteInput, nowMs?: number): RChainYieldRouteQuote;
  buildExecutionProbe(input: RChainYieldRouteInput, nowMs?: number): Promise<RChainExecutionProbeResult>;
}

export function isRobinhoodTestnetChain(chainId: number): boolean {
  return chainId === ROBINHOOD_TESTNET_CHAIN_ID;
}

export function resolveRChainZeroDevBundlerRpc(chainId: number): string | undefined {
  return isRobinhoodTestnetChain(chainId) ? R_CHAIN_ZERODEV_BUNDLER_RPC : undefined;
}

const STUB_APY_BPS: Record<RChainYieldAssetKind, number> = { rwa: 450, idle: 320 };
const ROUTE_TTL_MS = 300_000;

function fnv1a32(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic route id — FNV-1a over canonical route key (no RNG). */
export function buildDeterministicRouteId(input: RChainYieldRouteInput): string {
  const seed = `rchain:${input.assetKind}:${input.symbol}:${input.amountUsd}:${input.vaultId ?? "default"}`;
  const h1 = fnv1a32(seed);
  const h2 = fnv1a32(`${seed}:${h1}`);
  const hex = `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
  return `0x${hex.padEnd(64, "0").slice(0, 64)}`;
}

export function buildRChainIdleYieldEip712Probe(
  input: RChainYieldRouteInput,
  routeId: string,
  nowMs: number,
): RChainEip712IdleYieldProbe {
  return {
    domain: {
      name: R_CHAIN_STUB_DOMAIN_NAME,
      version: R_CHAIN_STUB_DOMAIN_VERSION,
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      verifyingContract: R_CHAIN_STUB_VERIFYING_CONTRACT,
    },
    types: {
      IdleYieldRoute: [
        { name: "assetKind", type: "string" },
        { name: "symbol", type: "string" },
        { name: "amountUsd", type: "uint256" },
        { name: "routeId", type: "bytes32" },
        { name: "nonce", type: "uint256" },
      ],
    },
    message: {
      assetKind: input.assetKind,
      symbol: input.symbol,
      amountUsd: Math.round(input.amountUsd * 1e6),
      routeId,
      nonce: nowMs,
    },
  };
}

/** Deterministic SHA-256 digest stub — Workers-safe, no external signer. */
export async function stubSignRChainProbe(eip712: RChainEip712IdleYieldProbe): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(eip712)),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export async function buildRChainExecutionProbe(
  input: RChainYieldRouteInput,
  nowMs = Date.now(),
): Promise<RChainExecutionProbeResult> {
  const routeId = buildDeterministicRouteId(input);
  const eip712 = buildRChainIdleYieldEip712Probe(input, routeId, nowMs);
  const digestStub = await stubSignRChainProbe(eip712);
  return {
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    routeId,
    eip712,
    digestStub,
    stubOnly: true,
    bridgeDeployed: false,
    contractDeployed: false,
  };
}

export const rChainYieldRouterStub: IRChainYieldRouter = {
  chainId: ROBINHOOD_TESTNET_CHAIN_ID,
  quoteRoute(input, nowMs = Date.now()) {
    return {
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      assetKind: input.assetKind,
      symbol: input.symbol,
      amountUsd: input.amountUsd,
      expectedApyBps: STUB_APY_BPS[input.assetKind],
      routeId: buildDeterministicRouteId(input),
      vaultId: input.vaultId ?? null,
      stubOnly: true,
      expiresAtMs: nowMs + ROUTE_TTL_MS,
    };
  },
  buildExecutionProbe: buildRChainExecutionProbe,
};
