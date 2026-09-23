/** GMX v2 synthetics — human-readable error category labels for revert diagnostics. */

export type GmxSyntheticsErrorLabel =
  | "AcceptablePrice"
  | "OracleStaleness"
  | "MinCollateralUsd"
  | "InsufficientExecutionFee"
  | "InvalidMarket"
  | "MarketNotFound";

const ACCEPTABLE_PRICE_PREFIXES = [
  "InvalidOrderPrices",
  "OrderNotFulfillableAtAcceptablePrice",
  "NegativeExecutionPrice",
  "PriceImpactLargerThanOrderSize",
] as const;
const ORACLE_STALENESS_PREFIXES = [
  "OraclePriceOutdated",
  "MaxPriceAgeExceeded",
  "GmInvalidBlockNumber",
  "SequencerDown",
  "SequencerGraceDurationNotYetPassed",
  "OracleTimestampsAreSmallerThanRequired",
  "OracleTimestampsAreLargerThanRequestExpirationTime",
  "EmptyPrimaryPrice",
  "ChainlinkPriceFeedNotUpdated",
] as const;

const EXECUTION_FEE_PREFIXES = ["InsufficientExecutionFee", "InsufficientWntAmountForExecutionFee"] as const;
const MIN_COLLATERAL_PREFIXES = [
  "InsufficientCollateralUsd",
  "InsufficientCollateralAmount",
  "MinPositionSize",
  "UnableToWithdrawCollateral",
] as const;
const INVALID_MARKET_PREFIXES = [
  "InvalidPositionMarket",
  "MarketNotFound",
  "UnexpectedMarket",
  "DisabledMarket",
  "EmptyMarket",
  "InvalidSwapMarket",
] as const;

function matchesPrefix(decoded: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => decoded.startsWith(p));
}

export function labelGmxSyntheticsError(decodedError: string): GmxSyntheticsErrorLabel | undefined {
  if (matchesPrefix(decodedError, ACCEPTABLE_PRICE_PREFIXES)) return "AcceptablePrice";
  if (matchesPrefix(decodedError, ORACLE_STALENESS_PREFIXES)) return "OracleStaleness";
  if (matchesPrefix(decodedError, EXECUTION_FEE_PREFIXES)) return "InsufficientExecutionFee";
  if (matchesPrefix(decodedError, MIN_COLLATERAL_PREFIXES)) return "MinCollateralUsd";
  if (decodedError.startsWith("MarketNotFound")) return "MarketNotFound";
  if (matchesPrefix(decodedError, INVALID_MARKET_PREFIXES)) return "InvalidMarket";
  return undefined;
}

export function formatGmxLabeledError(decodedError: string): string {
  const label = labelGmxSyntheticsError(decodedError);
  return label ? `[GMX:${label}] ${decodedError}` : decodedError;
}
