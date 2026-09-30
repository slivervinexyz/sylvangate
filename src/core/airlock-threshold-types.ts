/** Airlock threshold input/output types — pure core SSOT. */
import type { UsdaiAirlockInput } from "./risk-engine-usdai";
import type {
  PendleCrossGuardAirlockInput,
  PendleOracleAirlockInput,
  PendlePoolFactoryAirlockInput,
} from "./pendle-types";

export interface CrossSpreadAirlockInput {
  crossSpreadBps: number;
  isSpreadProfitable: boolean;
}

export interface GmxV2PriceImpactAirlockInput {
  priceImpactPenaltyBps: number;
  priceImpactSubsidiesBps: number;
  reducesImbalance: boolean;
}

export interface AirlockThresholdInput {
  symbol: string;
  hlSpot: number;
  hlPerp: number;
  dydxPerp: number;
  /** Approved venue key — must match `allowedVenues` when mandate is armed. */
  venueKey?: string;
  /** Alias for `venueKey` — agent-declared execution target. */
  targetVenue?: string;
  /** Session-key venue whitelist — unauthorized switch → `VENUE_DRIFT_REJECTED`. */
  allowedVenues?: readonly string[];
  /** EIP-712 / UserOp digest — bound to `chainId` + venue + `intentAction`. */
  intentDigest?: string;
  intentAction?: string;
  chainId?: number;
  /** Per-agent attempt budget key when digest absent. */
  agentId?: string;
  depthUsd?: number;
  maxSlippage?: number;
  orderSizeUsd?: number;
  accountBalanceUsd?: number;
  minDepthUsd?: number;
  isTestnet?: boolean;
  at?: Date;
  requestedLeverage?: number;
  crossSpread?: CrossSpreadAirlockInput;
  gmxPriceImpact?: GmxV2PriceImpactAirlockInput;
  pendleCrossGuard?: PendleCrossGuardAirlockInput;
  pendleOracle?: PendleOracleAirlockInput;
  pendlePoolFactory?: PendlePoolFactoryAirlockInput;
  usdai?: UsdaiAirlockInput;
  disableThresholdJitter?: boolean;
}

export interface AirlockThresholdResult {
  ok: boolean;
  tripped: boolean;
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  crossSpreadBps?: number;
  isSpreadProfitable?: boolean;
  priceImpactSubsidiesBps?: number;
  priceImpactPenaltyBps?: number;
  gmxReducesImbalance?: boolean;
  reasons: string[];
  airlockRiskUsd?: number;
  cappedMaxSlUsd?: number;
}
