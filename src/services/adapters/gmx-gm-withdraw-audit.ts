/** GMX v2 GM Pool withdrawal wire audit (IWithdrawalUtils / ExchangeRouter). */
import { getAddress, type Hex } from "viem";
import {
  collectGmxGmRiskInvariantErrors,
  type GmxGmRiskAuditContext,
} from "../../core/gmx-risk-core";
import { GMX_GM_ETH_USDC_MARKET } from "./gmx-gm-withdraw-constants";
import type { GmxGmWithdrawWireParams } from "./gmx-gm-withdraw-types";
import { GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";

export type GmxGmWithdrawAuditResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  fields: Record<string, string>;
};

export function auditGmxGmWithdrawWireParams(
  wire: GmxGmWithdrawWireParams,
  market: Hex = GMX_GM_ETH_USDC_MARKET,
  risk?: GmxGmRiskAuditContext,
): GmxGmWithdrawAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields: Record<string, string> = {
    receiver: wire.addresses.receiver,
    market: wire.addresses.market,
    minLongTokenAmount: wire.minLongTokenAmount.toString(),
    minShortTokenAmount: wire.minShortTokenAmount.toString(),
    executionFee: wire.executionFee.toString(),
    callbackGasLimit: wire.callbackGasLimit.toString(),
    dataListLen: String(wire.dataList.length),
  };
  const expectedMarket = getAddress(market);
  if (wire.addresses.market !== expectedMarket) {
    errors.push(`addresses.market mismatch: ${wire.addresses.market} != ${expectedMarket}`);
  }
  errors.push(
    ...collectGmxGmRiskInvariantErrors(risk, {
      executionFee: wire.executionFee,
      minLongTokenAmount: wire.minLongTokenAmount,
      minShortTokenAmount: wire.minShortTokenAmount,
    }),
  );
  if (wire.addresses.receiver === GMX_ZERO_ADDRESS) errors.push("receiver must not be zero");
  if (wire.addresses.longTokenSwapPath.length > 0) warnings.push("longTokenSwapPath non-empty");
  if (wire.addresses.shortTokenSwapPath.length > 0) warnings.push("shortTokenSwapPath non-empty");
  if (wire.dataList.length > 0) warnings.push("on-chain withdrawal wire typically uses empty dataList");
  for (const entry of wire.dataList) {
    if (entry.length !== 66) errors.push(`dataList entry must be bytes32, len ${entry.length}`);
  }
  return { ok: errors.length === 0, errors, warnings, fields };
}

export function assertGmxGmWithdrawWire(
  wire: GmxGmWithdrawWireParams,
  market?: Hex,
  risk?: GmxGmRiskAuditContext,
): void {
  const audit = auditGmxGmWithdrawWireParams(wire, market, risk);
  if (!audit.ok) throw new Error(`GMX_GM_WITHDRAW_AUDIT: ${audit.errors.join(" | ")}`);
}
