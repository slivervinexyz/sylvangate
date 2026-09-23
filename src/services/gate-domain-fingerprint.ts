/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 *
 * G11 — On-chain EIP-712 domain fingerprint for hijacked-frontend detection.
 */

import {
  type Address,
  type Hex,
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  toHex,
} from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import {
  EIP712_DOMAIN_VERSION,
  resolveGateEip712DomainName,
  SLIVERVINE_GATE_SEPOLIA_ADDRESS,
} from "../sdk/constants";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  resolveArbitrumRpcUrl,
} from "../adapters/arbitrum/zerodev-aa/zerodev-aa-chain";

/** Sepolia SliverVineGate — SSOT: `src/sdk/constants.ts` */
export { SLIVERVINE_GATE_SEPOLIA_ADDRESS };

const EIP712_DOMAIN_TYPEHASH = keccak256(
  toHex(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
  ),
);

const SLIVERVINE_GATE_DOMAIN_ABI = [
  {
    type: "function",
    name: "domainSeparator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export interface GateDomainFingerprintInput {
  chainId?: number;
  gateAddress?: Address;
  rpcUrl?: string;
  env?: Record<string, string>;
  /** Skip RPC read — compare expected local digest only (unit tests). */
  onChainSeparator?: Hex;
}

export interface GateDomainFingerprintResult {
  ok: boolean;
  chainId: number;
  gateAddress: Address;
  expected: Hex;
  onChain: Hex | null;
  domainName: string;
  domainVersion: typeof EIP712_DOMAIN_VERSION;
  reasons: string[];
}

function readEnv(env?: Record<string, string>): Record<string, string> {
  if (env) return env;
  return typeof process !== "undefined" ? (process.env as Record<string, string>) : {};
}

export function resolveGateAddress(
  env?: Record<string, string>,
  override?: Address,
): Address {
  const e = readEnv(env);
  const raw =
    override ??
    (e.SLIVERVINE_GATE_ADDRESS?.trim() as Address | undefined) ??
    getAddress(SLIVERVINE_GATE_SEPOLIA_ADDRESS);
  return getAddress(raw);
}

/** Independent EIP-712 domain recomputation — mirrors SliverVineGate.sol _buildDomainSeparator(). */
export function computeExpectedGateDomainSeparator(
  chainId: number,
  gateAddress: Address,
): Hex {
  const checksummed = getAddress(gateAddress);
  const nameHash = keccak256(toHex(resolveGateEip712DomainName(chainId)));
  const versionHash = keccak256(toHex(EIP712_DOMAIN_VERSION));
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        nameHash,
        versionHash,
        BigInt(chainId),
        checksummed,
      ],
    ),
  );
}

export async function readOnChainGateDomainSeparator(input: {
  chainId: number;
  gateAddress: Address;
  rpcUrl?: string;
  env?: Record<string, string>;
}): Promise<Hex> {
  const env = readEnv(input.env);
  const rpcUrl =
    input.rpcUrl ?? resolveArbitrumRpcUrl(env, input.chainId);
  const chain =
    input.chainId === ARBITRUM_SEPOLIA_CHAIN_ID ? arbitrumSepolia : arbitrum;
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  return client.readContract({
    address: input.gateAddress,
    abi: SLIVERVINE_GATE_DOMAIN_ABI,
    functionName: "domainSeparator",
  });
}

/** Verify on-chain DOMAIN_SEPARATOR() matches local EIP-712 recompute (anti-hijack fingerprint). */
export async function verifyGateDomainSeparator(
  input: GateDomainFingerprintInput = {},
): Promise<GateDomainFingerprintResult> {
  const env = readEnv(input.env);
  const chainId = input.chainId ?? ARBITRUM_SEPOLIA_CHAIN_ID;
  const domainName = resolveGateEip712DomainName(chainId);
  const gateAddress = resolveGateAddress(env, input.gateAddress);
  const expected = computeExpectedGateDomainSeparator(chainId, gateAddress);
  const reasons: string[] = [];

  let onChain: Hex | null = input.onChainSeparator ?? null;
  if (!onChain) {
    try {
      onChain = await readOnChainGateDomainSeparator({
        chainId,
        gateAddress,
        rpcUrl: input.rpcUrl,
        env,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reasons.push(`RPC_READ_FAILED:${message}`);
    }
  }

  if (onChain && onChain.toLowerCase() !== expected.toLowerCase()) {
    reasons.push("DOMAIN_SEPARATOR_MISMATCH");
  }
  if (onChain && onChain.toLowerCase() === expected.toLowerCase()) {
    return {
      ok: true,
      chainId,
      gateAddress,
      expected,
      onChain,
      domainName,
      domainVersion: EIP712_DOMAIN_VERSION,
      reasons: [],
    };
  }

  return {
    ok: false,
    chainId,
    gateAddress,
    expected,
    onChain,
    domainName,
    domainVersion: EIP712_DOMAIN_VERSION,
    reasons: reasons.length > 0 ? reasons : ["DOMAIN_UNVERIFIED"],
  };
}
