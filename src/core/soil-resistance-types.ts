/** Soil resistance input/output types — pure core SSOT. */
import type { UsdaiSoilInput } from "./risk-engine-usdai";
import type {
  PendleCrossGuardSoilInput,
  PendleOracleSoilInput,
  PendlePoolFactorySoilInput,
} from "./pendle-types";

export interface CrossSpreadSoilInput {
  crossSpreadBps: number;
  isSpreadProfitable: boolean;
}

export interface GmxV2PriceImpactSoilInput {
  priceImpactPenaltyBps: number;
  priceImpactSubsidiesBps: number;
  reducesImbalance: boolean;
}

export interface SoilResistanceInput {
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
  crossSpread?: CrossSpreadSoilInput;
  gmxPriceImpact?: GmxV2PriceImpactSoilInput;
  pendleCrossGuard?: PendleCrossGuardSoilInput;
  pendleOracle?: PendleOracleSoilInput;
  pendlePoolFactory?: PendlePoolFactorySoilInput;
  usdai?: UsdaiSoilInput;
  disableThresholdJitter?: boolean;
}

export interface SoilResistanceResult {
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
  soilRiskUsd?: number;
  cappedMaxSlUsd?: number;
}
