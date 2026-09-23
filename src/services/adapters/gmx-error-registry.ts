/** GMX v2 synthetics Errors.sol — registry ABI + operator metadata (ExchangeRouter / OrderHandler / Oracle / Vault). */
import { parseAbi } from "viem";

export type GmxErrorDomain =
  | "ExchangeRouter"
  | "OrderHandler"
  | "OrderUtils"
  | "BaseOrderUtils"
  | "MarketUtils"
  | "Oracle"
  | "GasUtils"
  | "Vault"
  | "PositionUtils"
  | "IncreasePositionUtils"
  | "DecreasePositionUtils"
  | "SwapOrderUtils"
  | "FeatureUtils"
  | "RoleModule"
  | "ExternalHandler"
  | "Unknown";

export type GmxErrorCategory =
  | "AcceptablePrice"
  | "OracleStaleness"
  | "MinCollateralUsd"
  | "InsufficientExecutionFee"
  | "MarketNotFound"
  | "InvalidMarket"
  | "OrderValidation"
  | "Authorization"
  | "SilentRevert"
  | "Generic";

export type GmxErrorDefinition = {
  domain: GmxErrorDomain;
  category: GmxErrorCategory;
  summary: string;
};

export const GMX_ERROR_REGISTRY_ABI = parseAbi([
  "error InsufficientExecutionFee(uint256 minExecutionFee, uint256 executionFee)",
  "error InsufficientWntAmountForExecutionFee(uint256 wntAmount, uint256 executionFee)",
  "error InvalidExecutionFee(uint256 executionFee, uint256 minExecutionFee, uint256 maxExecutionFee)",
  "error InsufficientNativeTokenAmount(uint256 msgValue, uint256 expectedNativeValue)",
  "error InsufficientCollateralUsd(int256 remainingCollateralUsd)",
  "error InsufficientCollateralAmount(uint256 collateralAmount, int256 collateralDeltaAmount)",
  "error MinPositionSize(uint256 positionSizeInUsd, uint256 minPositionSizeUsd)",
  "error UnableToWithdrawCollateral(int256 estimatedRemainingCollateralUsd)",
  "error EmptyOrder()",
  "error OrderTypeCannotBeCreated(uint256 orderType)",
  "error UnsupportedOrderType(uint256 orderType)",
  "error UnexpectedMarket()",
  "error InvalidPositionMarket(address market)",
  "error MarketNotFound(address key)",
  "error DisabledMarket(address market)",
  "error EmptyMarket()",
  "error InvalidSwapMarket(address market)",
  "error InvalidReceiver(address receiver)",
  "error UnexpectedValidFromTime(uint256 orderType)",
  "error Unauthorized(address msgSender, string role)",
  "error InvalidOrderPrices(uint256 primaryPriceMin, uint256 primaryPriceMax, uint256 triggerPrice, uint256 orderType)",
  "error OrderNotFulfillableAtAcceptablePrice(uint256 price, uint256 acceptablePrice)",
  "error DisabledFeature(bytes32 key)",
  "error OrderNotFound(bytes32 key)",
  "error OrderNotUpdatable(uint256 orderType)",
  "error OraclePriceOutdated()",
  "error MaxPriceAgeExceeded(uint256 oracleTimestamp, uint256 currentTimestamp)",
  "error GmInvalidBlockNumber(uint256 minOracleBlockNumber, uint256 currentBlockNumber)",
  "error SequencerDown()",
  "error SequencerGraceDurationNotYetPassed(uint256 timeSinceUp, uint256 sequencerGraceDuration)",
  "error OracleTimestampsAreSmallerThanRequired(uint256 minOracleTimestamp, uint256 expectedTimestamp)",
  "error EmptyPrimaryPrice(address token)",
  "error ExternalCallFailed(bytes data)",
  "error SelfTransferNotSupported(address receiver)",
  "error InvalidNativeTokenSender(address msgSender)",
]);

function def(domain: GmxErrorDomain, category: GmxErrorCategory, summary: string): GmxErrorDefinition {
  return { domain, category, summary };
}

export const GMX_ERROR_DEFINITIONS: Record<string, GmxErrorDefinition> = {
  InsufficientExecutionFee: def("GasUtils", "InsufficientExecutionFee", "executionFee below GasUtils.validateExecutionFee minimum"),
  InsufficientWntAmountForExecutionFee: def("GasUtils", "InsufficientExecutionFee", "sendWnt deposited less WNT than executionFee requires"),
  InvalidExecutionFee: def("GasUtils", "InsufficientExecutionFee", "executionFee outside allowed min/max band"),
  InsufficientNativeTokenAmount: def("ExchangeRouter", "InsufficientExecutionFee", "multicall msg.value does not cover native transfers"),
  InsufficientCollateralUsd: def("PositionUtils", "MinCollateralUsd", "collateral USD below GMX minimum after fees"),
  InsufficientCollateralAmount: def("IncreasePositionUtils", "MinCollateralUsd", "token collateral amount insufficient for delta"),
  MinPositionSize: def("PositionUtils", "MinCollateralUsd", "position size below market minPositionSizeUsd"),
  UnableToWithdrawCollateral: def("DecreasePositionUtils", "MinCollateralUsd", "remaining collateral would fall below minimum"),
  InvalidOrderPrices: def("OrderUtils", "AcceptablePrice", "trigger/acceptable price band incompatible with oracle primary prices"),
  OrderNotFulfillableAtAcceptablePrice: def("BaseOrderUtils", "AcceptablePrice", "oracle execution price violates acceptablePrice slippage bound"),
  MarketNotFound: def("MarketUtils", "MarketNotFound", "market token not registered in DataStore"),
  InvalidPositionMarket: def("MarketUtils", "InvalidMarket", "market token invalid for position operation"),
  DisabledMarket: def("MarketUtils", "InvalidMarket", "market disabled in GMX config"),
  EmptyMarket: def("MarketUtils", "InvalidMarket", "market struct empty or uninitialized"),
  InvalidSwapMarket: def("MarketUtils", "InvalidMarket", "swap path references unsupported market"),
  UnexpectedMarket: def("SwapOrderUtils", "InvalidMarket", "order market does not match swap route expectation"),
  OraclePriceOutdated: def("Oracle", "OracleStaleness", "oracle price feed stale (Timelock)"),
  MaxPriceAgeExceeded: def("Oracle", "OracleStaleness", "oracle timestamp older than maxPriceAge"),
  GmInvalidBlockNumber: def("Oracle", "OracleStaleness", "oracle block number behind chain head"),
  SequencerDown: def("Oracle", "OracleStaleness", "Arbitrum sequencer offline"),
  SequencerGraceDurationNotYetPassed: def("Oracle", "OracleStaleness", "sequencer grace period not elapsed after restart"),
  OracleTimestampsAreSmallerThanRequired: def("Oracle", "OracleStaleness", "oracle timestamps below request minimum"),
  EmptyPrimaryPrice: def("Oracle", "OracleStaleness", "no primary oracle price set for token"),
  EmptyOrder: def("OrderUtils", "OrderValidation", "createOrder params empty"),
  OrderTypeCannotBeCreated: def("OrderUtils", "OrderValidation", "orderType not allowed for create"),
  UnsupportedOrderType: def("OrderUtils", "OrderValidation", "orderType unsupported"),
  InvalidReceiver: def("OrderUtils", "OrderValidation", "receiver address invalid"),
  UnexpectedValidFromTime: def("OrderUtils", "OrderValidation", "validFromTime not allowed for orderType"),
  OrderNotFound: def("OrderHandler", "OrderValidation", "order key not in store"),
  OrderNotUpdatable: def("OrderHandler", "OrderValidation", "frozen or non-updatable order"),
  DisabledFeature: def("FeatureUtils", "Authorization", "GMX feature flag disabled"),
  Unauthorized: def("RoleModule", "Authorization", "caller missing required role"),
  ExternalCallFailed: def("ExternalHandler", "Generic", "nested external call reverted"),
  SelfTransferNotSupported: def("Vault", "Generic", "Bank self-transfer blocked"),
  InvalidNativeTokenSender: def("Vault", "Generic", "native token sender not router"),
};

export function lookupGmxErrorDefinition(errorName: string): GmxErrorDefinition {
  return GMX_ERROR_DEFINITIONS[errorName] ?? {
    domain: "Unknown",
    category: "Generic",
    summary: `unmapped GMX custom error ${errorName}`,
  };
}
