/** Shared Viem client slices for GMX micro-fill adapters. */
import type { Hex, PublicClient } from "viem";

export type GmxMicroFillReadClient = Pick<PublicClient, "readContract">;
export type GmxMicroFillWriteClient = Pick<PublicClient, "readContract" | "waitForTransactionReceipt">;
export type GmxMicroFillSimulateClient = Pick<PublicClient, "simulateContract">;

export type GmxKernelCall = { to: Hex; value: bigint; data: Hex };
