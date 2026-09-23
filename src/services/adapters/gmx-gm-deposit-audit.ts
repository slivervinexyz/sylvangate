/** GMX v2 GM Pool deposit wire audit (IDepositUtils / ExchangeRouter). */
import { getAddress, type Hex } from "viem";
import {
  collectGmxGmRiskInvariantErrors,
  type GmxGmRiskAuditContext,
} from "../../core/gmx-risk-core";
import { GMX_GM_ETH_USDC_LONG_TOKEN, GMX_GM_ETH_USDC_MARKET, GMX_GM_ETH_USDC_SHORT_TOKEN } from "./gmx-gm-deposit-constants";
import type { GmxGmDepositWireParams } from "./gmx-gm-deposit-types";
import { GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";

export type GmxGmDepositAuditResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  fields: Record<string, string>;
};

export function auditGmxGmDepositWireParams(
  wire: GmxGmDepositWireParams,
  market: Hex = GMX_GM_ETH_USDC_MARKET,
  risk?: GmxGmRiskAuditContext,
): GmxGmDepositAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields: Record<string, string> = {
    receiver: wire.addresses.receiver,
    market: wire.addresses.market,
    initialLongToken: wire.addresses.initialLongToken,
    initialShortToken: wire.addresses.initialShortToken,
    minMarketTokens: wire.minMarketTokens.toString(),
    executionFee: wire.executionFee.toString(),
    callbackGasLimit: wire.callbackGasLimit.toString(),
    dataListLen: String(wire.dataList.length),
  };
  const expectedMarket = getAddress(market);
  if (wire.addresses.market !== expectedMarket) {
    errors.push(`addresses.market mismatch: ${wire.addresses.market} != ${expectedMarket}`);
  }
  if (wire.addresses.initialLongToken !== GMX_GM_ETH_USDC_LONG_TOKEN) {
    errors.push(`initialLongToken expected ${GMX_GM_ETH_USDC_LONG_TOKEN}`);
  }
  if (wire.addresses.initialShortToken !== GMX_GM_ETH_USDC_SHORT_TOKEN) {
    errors.push(`initialShortToken expected ${GMX_GM_ETH_USDC_SHORT_TOKEN}`);
  }
  errors.push(
    ...collectGmxGmRiskInvariantErrors(risk, {
      executionFee: wire.executionFee,
      minMarketTokens: wire.minMarketTokens,
    }),
  );
  if (wire.addresses.receiver === GMX_ZERO_ADDRESS) errors.push("receiver must not be zero");
  if (wire.addresses.longTokenSwapPath.length > 0) warnings.push("longTokenSwapPath non-empty");
  if (wire.addresses.shortTokenSwapPath.length > 0) warnings.push("shortTokenSwapPath non-empty");
  if (wire.dataList.length > 0) warnings.push("on-chain deposit wire typically uses empty dataList");
  for (const entry of wire.dataList) {
    if (entry.length !== 66) errors.push(`dataList entry must be bytes32, len ${entry.length}`);
  }
  return { ok: errors.length === 0, errors, warnings, fields };
}

export function assertGmxGmDepositWire(
  wire: GmxGmDepositWireParams,
  market?: Hex,
  risk?: GmxGmRiskAuditContext,
): void {
  const audit = auditGmxGmDepositWireParams(wire, market, risk);
  if (!audit.ok) throw new Error(`GMX_GM_DEPOSIT_AUDIT: ${audit.errors.join(" | ")}`);
}
