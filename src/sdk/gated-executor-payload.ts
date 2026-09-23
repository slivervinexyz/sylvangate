/** Mirrors GatedExecutor.payloadHash — binds calldata without touching RiskAttestation EIP-712. */
import { encodeAbiParameters, keccak256, type Hex } from "viem";

export interface GatedExecutorPayloadBinding {
  chainId: number;
  executor: `0x${string}`;
  initiator: `0x${string}`;
  target: `0x${string}`;
  data: Hex;
  nonce: bigint;
}

export function computeGatedExecutorPayloadHash(input: GatedExecutorPayloadBinding): Hex {
  const encoded = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "bytes32" },
      { type: "uint256" },
    ],
    [
      BigInt(input.chainId),
      input.executor,
      input.initiator,
      input.target,
      keccak256(input.data),
      input.nonce,
    ],
  );
  return keccak256(encoded);
}
