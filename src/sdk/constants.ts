/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * @slivervine/exomesh-agentic-wallet-guard — brand & EIP-712 domain SSOT.
 */
import { resolveGateAddressForChain } from "../config/contract-deployments";
import { GMX_UI_FEE_BPS } from "../config/gmx-revenue";
import { SESSION_KEY_NOTIONAL_CAP_USD } from "../services/session-key-adapter-lib/session-key-types";

/** ExoMesh Gate EIP-712 domain (42161 + 421614 redeploy). */
export const GATE_EIP712_DOMAIN_EXOMESH_WIRE = "SliverVineExoMesh" as const;
export const GATE_EIP712_DOMAIN_MAINNET_WIRE = GATE_EIP712_DOMAIN_EXOMESH_WIRE;
export const GATE_EIP712_DOMAIN_SEPOLIA_WIRE = GATE_EIP712_DOMAIN_EXOMESH_WIRE;

/** @deprecated Use resolveGateEip712DomainName(chainId). */
export const GATE_EIP712_DOMAIN_WIRE = GATE_EIP712_DOMAIN_EXOMESH_WIRE;
/** @deprecated Use resolveGateEip712DomainName(chainId). */
export const EIP712_DOMAIN_NAME = GATE_EIP712_DOMAIN_EXOMESH_WIRE;
export const EIP712_DOMAIN_VERSION = "1" as const;

export function resolveGateEip712DomainName(_chainId?: number): string {
  return GATE_EIP712_DOMAIN_EXOMESH_WIRE;
}

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630 as const;
export const ROBINHOOD_MAINNET_CHAIN_ID = 4663 as const;
export const ARBITRUM_ONE_CHAIN_ID = 42161 as const;

/** Local / unit-test mock Gate verifyingContract (not deployed). */
export const LOCAL_MOCK_GATE_ADDRESS =
  "0x511E111111111111111111111111111111111111" as const;

/** Arbitrum Sepolia (421614) — ExoMesh SliverVineGate. */
export const SLIVERVINE_GATE_SEPOLIA_ADDRESS = resolveGateAddressForChain(
  ARBITRUM_SEPOLIA_CHAIN_ID,
);

/** Arbitrum One (42161) — ExoMesh SliverVineGate. */
export const SLIVERVINE_GATE_MAINNET_ADDRESS = resolveGateAddressForChain(
  ARBITRUM_ONE_CHAIN_ID,
);

/** Default EIP-712 verifyingContract (Arbitrum One production anchor). */
export const SLIVERVINE_GATE_ADDRESS = SLIVERVINE_GATE_MAINNET_ADDRESS;

/** Hard USD notional cap for session-key authorization (R07). SSOT: `session-key-types.ts`. */
export { SESSION_KEY_NOTIONAL_CAP_USD };

/** GMX v2 ExchangeRouter native builder fee — SSOT: +10 bps (`gmx-revenue.ts`). */
export { GMX_UI_FEE_BPS };

export function resolveSliverVineGateAddress(chainId?: number): string {
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) return SLIVERVINE_GATE_SEPOLIA_ADDRESS;
  if (chainId === ARBITRUM_ONE_CHAIN_ID) return SLIVERVINE_GATE_MAINNET_ADDRESS;
  return SLIVERVINE_GATE_ADDRESS;
}

export type ExoMeshSdkPreset = "production" | "test";
