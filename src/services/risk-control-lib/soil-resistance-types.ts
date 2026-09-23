/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 * Soil resistance types — re-export shell (SSOT: core/soil-resistance-types).
 */
export {
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  HL_TESTNET_MIN_DEPTH_USD,
  VINE_SOIL_MAX_SLIPPAGE,
  resolveSoilMinDepthUsd,
} from "../../core/soil-resistance-core";

export type {
  CrossSpreadSoilInput,
  GmxV2PriceImpactSoilInput,
  SoilResistanceInput,
  SoilResistanceResult,
} from "../../core/soil-resistance-types";
