/** Wallet A — GMX v2 ETH Synthetic Short (MarketIncrease · USDC collateral). Wallet B excluded. */
import { getAddress, type Hex } from "viem";
import { GMX_ETH_USD_MARKET_TOKEN } from "../../config/gmx-markets";
import { GMX_UI_FEE_RECEIVER } from "../../config/gmx-revenue";
import { assertWalletBPerpIsolation } from "../../core/wallet-isolation-guard";
import { HL_WALLET_A_DEFAULT } from "../gmx-cross-wallet-hedge-fetch";
import type { GmxV2PoolWeights } from "../yield/gmx-v2-price-impact";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { buildGmxCreateOrderWireParams, type GmxCreateOrderWireParams } from "./gmx-create-order-encode";
import {
  buildGmxMarketIncreaseMulticallCalls,
  encodeGmxExchangeRouterMulticall,
} from "./gmx-market-increase-multicall";
import { buildGmxV2UnsignedOrderPayload } from "./gmx-v2-order-payload";
import { GMX_ORDER_TYPE_INDEX } from "./gmx-v2-order-payload.types";

export const GMX_WALLET_A_SHORT_DEFAULT = getAddress(HL_WALLET_A_DEFAULT);
export const GMX_WALLET_A_SHORT_MARKET = getAddress(GMX_ETH_USD_MARKET_TOKEN);
export const GMX_WALLET_A_SHORT_MIN_COLLATERAL_USD = 10;

export type GmxWalletAShortBuildInput = {
  walletA?: Hex;
  sizeUsd: number;
  midPriceUsd: number;
  maxSlippageBps?: number;
  executionFeeWei?: string;
  signedImpactBps?: number;
  pool?: GmxV2PoolWeights;
};

export type GmxWalletAShortBuildResult = {
  walletA: Hex;
  payload: GmxV2UnsignedOrderPayload;
  wire: GmxCreateOrderWireParams;
  calls: Hex[];
  multicallData: Hex;
  msgValue: bigint;
  collateral: bigint;
  executionFee: bigint;
};

function assertWalletAIsolation(walletA: Hex): void {
  assertWalletBPerpIsolation(walletA);
}

/** Short wire audit — !isLong && acceptablePrice > 0 && MarketIncrease. */
export function auditGmxWalletAShortWire(wire: GmxCreateOrderWireParams): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (wire.isLong) errors.push("isLong must be false");
  if (wire.numbers.acceptablePrice <= 0n) errors.push("acceptablePrice must be > 0 for short MarketIncrease");
  if (wire.orderType !== GMX_ORDER_TYPE_INDEX.MarketIncrease) {
    errors.push(`orderType must be MarketIncrease(${GMX_ORDER_TYPE_INDEX.MarketIncrease})`);
  }
  if (wire.addresses.market !== GMX_WALLET_A_SHORT_MARKET) errors.push("market must be ETH/USDC SSOT");
  return { ok: errors.length === 0, errors };
}

export function buildGmxWalletAShortOrder(input: GmxWalletAShortBuildInput): GmxWalletAShortBuildResult {
  const walletA = getAddress(input.walletA ?? GMX_WALLET_A_SHORT_DEFAULT);
  assertWalletAIsolation(walletA);

  const payload = buildGmxV2UnsignedOrderPayload(
    {
      side: "short",
      sizeUsd: input.sizeUsd,
      marketToken: GMX_WALLET_A_SHORT_MARKET,
      midPriceUsd: input.midPriceUsd,
      maxSlippageBps: input.maxSlippageBps,
      signedImpactBps: input.signedImpactBps,
      pool: input.pool,
      receiver: walletA,
      uiFeeReceiver: GMX_UI_FEE_RECEIVER,
    },
    { executionFeeWei: input.executionFeeWei },
  );

  if (payload.isLong) throw new Error("[GMX_SHORT_HEDGE] payload.isLong must be false");
  const wire = buildGmxCreateOrderWireParams(payload, GMX_WALLET_A_SHORT_MARKET);
  const audit = auditGmxWalletAShortWire(wire);
  if (!audit.ok) throw new Error(`[GMX_SHORT_HEDGE] WIRE_AUDIT: ${audit.errors.join(" | ")}`);

  const { calls, msgValue, executionFee, collateral } = buildGmxMarketIncreaseMulticallCalls({
    payload,
    market: GMX_WALLET_A_SHORT_MARKET,
  });
  const { data } = encodeGmxExchangeRouterMulticall(calls, msgValue);

  console.log("[GMX_SHORT_HEDGE] build_ok", {
    walletA,
    isLong: payload.isLong,
    sizeUsd: input.sizeUsd,
    acceptablePrice: payload.numbers.acceptablePrice,
    collateral: collateral.toString(),
    executionFee: executionFee.toString(),
    msgValue: msgValue.toString(),
  });

  return { walletA, payload, wire, calls, multicallData: data, msgValue, collateral, executionFee };
}
