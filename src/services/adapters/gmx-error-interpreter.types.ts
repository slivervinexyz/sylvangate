import type { Hex } from "viem";
import type { GmxErrorCategory, GmxErrorDomain } from "./gmx-error-registry";
import type { GmxSyntheticsErrorLabel } from "./gmx-synthetics-error-labels";

export type GmxInterpretContext = {
  isLong?: boolean;
  slippageBps?: number;
  oraclePriceRaw?: bigint;
  acceptablePrice?: bigint;
  executionFee?: bigint;
  market?: Hex;
};

export type GmxInterpretedError = {
  selector: Hex;
  errorName: string;
  domain: GmxErrorDomain;
  category: GmxErrorCategory;
  label?: GmxSyntheticsErrorLabel;
  args: readonly unknown[];
  decoded: string;
  summary: string;
  guidance: string[];
  rawData: Hex;
  silent: boolean;
  adjustments?: {
    acceptablePrice?: { current: bigint; suggested: bigint; deltaBps: number; oracleHumanUsd?: number };
    executionFee?: { current: bigint; minimum: bigint; deficit: bigint };
  };
};
