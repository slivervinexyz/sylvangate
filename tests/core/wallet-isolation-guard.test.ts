import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { GMX_UI_FEE_RECEIVER } from "../../src/config/gmx-revenue";
import { HL_WALLET_A_DEFAULT } from "../../src/services/gmx-cross-wallet-hedge-fetch";
import {
  assertGmxPerpOrderReceiverIsolation,
  assertWalletBPerpIsolation,
  GMX_WALLET_B_ISOLATION_ADDRESS,
  isWalletBIsolationAddress,
  WALLET_B_PERP_FORBIDDEN,
} from "../../src/core/wallet-isolation-guard";
import { buildGmxCreateOrderWireParams } from "../../src/services/adapters/gmx-create-order-encode";
import { buildGmxV2UnsignedOrderPayload } from "../../src/services/adapters/gmx-v2-order-payload";
import { buildGmxWalletAShortOrder } from "../../src/services/adapters/gmx-v2-wallet-a-short-builder";
import { GMX_ETH_USD_MARKET_TOKEN } from "../../src/config/gmx-markets";

const WALLET_A = getAddress(HL_WALLET_A_DEFAULT);
const WALLET_B = getAddress(GMX_UI_FEE_RECEIVER);
const MARKET = getAddress(GMX_ETH_USD_MARKET_TOKEN);

describe("wallet-isolation-guard", () => {
  it("flags Wallet B isolation address", () => {
    expect(GMX_WALLET_B_ISOLATION_ADDRESS).toBe(WALLET_B);
    expect(isWalletBIsolationAddress(WALLET_B)).toBe(true);
    expect(isWalletBIsolationAddress(WALLET_A)).toBe(false);
  });

  it("throws WALLET_B_PERP_FORBIDDEN for Wallet B", () => {
    expect(() => assertWalletBPerpIsolation(WALLET_B)).toThrow(WALLET_B_PERP_FORBIDDEN);
    expect(() => assertGmxPerpOrderReceiverIsolation({ receiver: WALLET_B })).toThrow(WALLET_B_PERP_FORBIDDEN);
  });

  it("allows Wallet A receiver", () => {
    expect(() => assertGmxPerpOrderReceiverIsolation({ receiver: WALLET_A })).not.toThrow();
  });

  it("rejects Wallet B in buildGmxV2UnsignedOrderPayload (long and short)", () => {
    for (const side of ["long", "short"] as const) {
      expect(() =>
        buildGmxV2UnsignedOrderPayload({
          side,
          sizeUsd: 10,
          midPriceUsd: 3500,
          marketToken: MARKET,
          receiver: WALLET_B,
          skipFailClosedGuards: true,
          allowStaleOracle: true,
        }),
      ).toThrow(WALLET_B_PERP_FORBIDDEN);
    }
  });

  it("rejects Wallet B in buildGmxCreateOrderWireParams", () => {
    const payload = buildGmxV2UnsignedOrderPayload({
      side: "short",
      sizeUsd: 10,
      midPriceUsd: 3500,
      marketToken: MARKET,
      receiver: WALLET_A,
      skipFailClosedGuards: true,
      allowStaleOracle: true,
    });
    expect(() =>
      buildGmxCreateOrderWireParams({ ...payload, addresses: { ...payload.addresses, receiver: WALLET_B } }, MARKET),
    ).toThrow(WALLET_B_PERP_FORBIDDEN);
  });

  it("rejects Wallet B in buildGmxWalletAShortOrder", () => {
    expect(() => buildGmxWalletAShortOrder({ walletA: WALLET_B, sizeUsd: 10, midPriceUsd: 3500 })).toThrow(
      WALLET_B_PERP_FORBIDDEN,
    );
  });
});
