/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 * Pure soil math — thin re-export shell (SSOT: core/soil-resistance-core).
 */

import {
  computeOrderAwareMaxSlUsd,
  computeSoilRiskUsd,
} from "../effective-max-sl";
import {
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./soil-resistance-types";

export {
  packSoilLane,
  evaluateSoilSlippagePacked,
  computeSoilSlippageMetrics,
  type SoilSlippageOverrides,
} from "../../core/soil-resistance-core";

export function applySoilRiskCaps(
  input: SoilResistanceInput,
  result: SoilResistanceResult,
  slippageFuse: number,
): void {
  const orderSize = Number(input.orderSizeUsd);
  const balance = Number(input.accountBalanceUsd);
  if (!(Number.isFinite(orderSize) && orderSize > 0)) return;

  const slipForRisk =
    Number.isFinite(result.crossVenueSlippage) && result.crossVenueSlippage >= 0
      ? result.crossVenueSlippage
      : slippageFuse;
  result.soilRiskUsd = computeSoilRiskUsd(orderSize, slipForRisk);
  if (Number.isFinite(balance) && balance >= 0) {
    result.cappedMaxSlUsd = computeOrderAwareMaxSlUsd(balance, orderSize, slippageFuse);
  }
}
