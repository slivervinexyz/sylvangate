/**
 * SylvanGate SKU — Arbitrum destination gate addresses (42161 / 421614).
 * Robinhood Home Chain (4663) uses attestation stubs only; no on-chain gate deploy in this SKU.
 * 42161 gate = destination metadata for treasury quotes + EIP-712 via sdk/constants.ts.
 */
export const ARBITRUM_ONE_CHAIN_ID = 42161 as const;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;

/** Mainnet ExoMesh Gate redeploy (42161 · domain `SliverVineExoMesh`). */
export const SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS =
  "0x71D7d26f98110c5DE3df0fCbddCf2A3A2BC6e2f1" as const;

/** Sepolia ExoMesh Gate redeploy (421614 · domain `SliverVineExoMesh`). */
export const SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS =
  "0xc66F96611a737c4e58706D0955594456eAb88959" as const;

export function resolveGateAddressForChain(chainId: number): `0x${string}` {
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS;
  }
  return SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS;
}
