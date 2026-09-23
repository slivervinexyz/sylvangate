/**
 * GMX v2 execution fee — mirrors gmx-interface `getExecutionFee` + GasUtils.validateExecutionFee.
 * Reads gas limits from on-chain DataStore; applies Arbitrum 30% buffer (defaultExecutionFeeBufferBps).
 */
import { GMX_V2_DATASTORE } from "../../adapters/gmx";
import { GMX_MARKET_DECREASE_EXECUTION_FEE_MIN_WEI } from "./gmx-micro-fill-constants";
import { DEFAULT_GMX_EXECUTION_FEE_WEI } from "../risk/arbitrum-gas-guard-lib/arbitrum-gas-guard-eval";
import { hashString } from "./gmx-v2-datastore-lib/gmx-v2-datastore-keys";
import type { PublicClient } from "viem";

const DATASTORE_GET_UINT = "0xbd02d0f5";
const FLOAT_PRECISION = 10n ** 30n;
const ARBITRUM_EXECUTION_FEE_BUFFER_BPS = 3000n;
const GMX_DATASTORE_KEYS = {
  increaseOrderGasLimit: hashString("INCREASE_ORDER_GAS_LIMIT"),
  decreaseOrderGasLimit: hashString("DECREASE_ORDER_GAS_LIMIT"),
  singleSwapGasLimit: hashString("SINGLE_SWAP_GAS_LIMIT"),
  estimatedGasFeeBaseAmount: hashString("ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1"),
  estimatedGasFeePerOraclePrice: hashString("ESTIMATED_GAS_FEE_PER_ORACLE_PRICE"),
  estimatedGasFeeMultiplierFactor: hashString("ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR"),
} as const;

export type GmxGasLimitsConfig = {
  increaseOrderGasLimit: bigint;
  decreaseOrderGasLimit: bigint;
  singleSwapGasLimit: bigint;
  estimatedGasFeeBaseAmount: bigint;
  estimatedGasFeePerOraclePrice: bigint;
  estimatedGasFeeMultiplierFactor: bigint;
};

function encodeGetUint(key: string): `0x${string}` {
  return `${DATASTORE_GET_UINT}${key.slice(2).padStart(64, "0")}` as `0x${string}`;
}

function decodeUint(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function applyFactor(value: bigint, factor: bigint): bigint {
  return (value * factor) / FLOAT_PRECISION;
}

export function estimateGmxOrderOraclePriceCount(swapPathLength: number): bigint {
  return 3n + BigInt(swapPathLength);
}

export function estimateGmxExecuteIncreaseOrderGasLimit(
  limits: GmxGasLimitsConfig,
  swapPathLength: number,
  callbackGasLimit: bigint,
): bigint {
  return limits.increaseOrderGasLimit
    + limits.singleSwapGasLimit * BigInt(swapPathLength)
    + callbackGasLimit;
}

export function estimateGmxExecuteDecreaseOrderGasLimit(
  limits: GmxGasLimitsConfig,
  swapPathLength: number,
  callbackGasLimit: bigint,
): bigint {
  const decreaseBase = limits.decreaseOrderGasLimit > 0n ? limits.decreaseOrderGasLimit : limits.increaseOrderGasLimit;
  return decreaseBase
    + limits.singleSwapGasLimit * BigInt(swapPathLength)
    + callbackGasLimit;
}

function resolveGmxExecutionFeeFloorWei(): bigint {
  const legacy = BigInt(DEFAULT_GMX_EXECUTION_FEE_WEI);
  return legacy > GMX_MARKET_DECREASE_EXECUTION_FEE_MIN_WEI ? legacy : GMX_MARKET_DECREASE_EXECUTION_FEE_MIN_WEI;
}

export function adjustGmxGasLimitForEstimate(
  limits: GmxGasLimitsConfig,
  estimatedGasLimit: bigint,
  oraclePriceCount: bigint,
): bigint {
  let base = limits.estimatedGasFeeBaseAmount + limits.estimatedGasFeePerOraclePrice * oraclePriceCount;
  return base + applyFactor(estimatedGasLimit, limits.estimatedGasFeeMultiplierFactor);
}

export function computeGmxExecutionFeeFromGasLimit(gasLimit: bigint, gasPriceWei: bigint, bufferBps = ARBITRUM_EXECUTION_FEE_BUFFER_BPS): bigint {
  const raw = gasLimit * gasPriceWei;
  return raw + (raw * bufferBps) / 10_000n;
}

export async function fetchGmxGasLimitsFromDataStore(
  client: Pick<PublicClient, "call">,
  dataStore = GMX_V2_DATASTORE,
): Promise<GmxGasLimitsConfig> {
  const entries = Object.entries(GMX_DATASTORE_KEYS) as [keyof GmxGasLimitsConfig, string][];
  const results = await Promise.all(
    entries.map(([, key]) => client.call({ to: dataStore as `0x${string}`, data: encodeGetUint(key) })),
  );
  const out: GmxGasLimitsConfig = {
    increaseOrderGasLimit: 0n,
    decreaseOrderGasLimit: 0n,
    singleSwapGasLimit: 0n,
    estimatedGasFeeBaseAmount: 0n,
    estimatedGasFeePerOraclePrice: 0n,
    estimatedGasFeeMultiplierFactor: 0n,
  };
  entries.forEach(([name], i) => {
    out[name] = decodeUint(results[i]?.data ?? "0x");
  });
  return out;
}

export async function estimateGmxMarketIncreaseExecutionFeeWei(input: {
  client: Pick<PublicClient, "call" | "getBlock" | "estimateFeesPerGas">;
  swapPathLength?: number;
  callbackGasLimit?: bigint;
  gasPriceWei?: bigint;
  bufferBps?: bigint;
}): Promise<{ executionFeeWei: string; gasLimit: bigint; gasPriceWei: bigint }> {
  const swapPathLength = input.swapPathLength ?? 0;
  const callbackGasLimit = input.callbackGasLimit ?? 0n;
  const limits = await fetchGmxGasLimitsFromDataStore(input.client);
  const estimated = estimateGmxExecuteIncreaseOrderGasLimit(limits, swapPathLength, callbackGasLimit);
  const oracleCount = estimateGmxOrderOraclePriceCount(swapPathLength);
  const gasLimit = adjustGmxGasLimitForEstimate(limits, estimated, oracleCount);
  let gasPriceWei = input.gasPriceWei ?? 0n;
  if (gasPriceWei <= 0n) {
    const [block, fees] = await Promise.all([
      input.client.getBlock({ blockTag: "latest" }),
      input.client.estimateFeesPerGas(),
    ]);
    const base = block.baseFeePerGas ?? fees.maxFeePerGas ?? 1n;
    const priority = fees.maxPriorityFeePerGas ?? 0n;
    gasPriceWei = base + priority;
  }
  const buffered = computeGmxExecutionFeeFromGasLimit(gasLimit, gasPriceWei, input.bufferBps);
  const floor = resolveGmxExecutionFeeFloorWei();
  const executionFee = buffered > floor ? buffered : floor;
  return { executionFeeWei: executionFee.toString(), gasLimit, gasPriceWei };
}

export async function estimateGmxMarketDecreaseExecutionFeeWei(input: {
  client: Pick<PublicClient, "call" | "getBlock" | "estimateFeesPerGas">;
  swapPathLength?: number;
  callbackGasLimit?: bigint;
  gasPriceWei?: bigint;
  bufferBps?: bigint;
}): Promise<{ executionFeeWei: string; gasLimit: bigint; gasPriceWei: bigint; floorWei: bigint }> {
  const swapPathLength = input.swapPathLength ?? 0;
  const callbackGasLimit = input.callbackGasLimit ?? 0n;
  const limits = await fetchGmxGasLimitsFromDataStore(input.client);
  const estimated = estimateGmxExecuteDecreaseOrderGasLimit(limits, swapPathLength, callbackGasLimit);
  const oracleCount = estimateGmxOrderOraclePriceCount(swapPathLength);
  const gasLimit = adjustGmxGasLimitForEstimate(limits, estimated, oracleCount);
  let gasPriceWei = input.gasPriceWei ?? 0n;
  if (gasPriceWei <= 0n) {
    const [block, fees] = await Promise.all([
      input.client.getBlock({ blockTag: "latest" }),
      input.client.estimateFeesPerGas(),
    ]);
    const base = block.baseFeePerGas ?? fees.maxFeePerGas ?? 1n;
    const priority = fees.maxPriorityFeePerGas ?? 0n;
    gasPriceWei = base + priority;
  }
  const buffered = computeGmxExecutionFeeFromGasLimit(gasLimit, gasPriceWei, input.bufferBps);
  const floor = resolveGmxExecutionFeeFloorWei();
  const executionFee = buffered > floor ? buffered : floor;
  return { executionFeeWei: executionFee.toString(), gasLimit, gasPriceWei, floorWei: floor };
}
