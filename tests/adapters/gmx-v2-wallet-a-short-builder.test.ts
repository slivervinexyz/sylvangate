import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { GMX_WALLET_B_DEFAULT } from "../../src/services/gmx-eth-delta";
import { WALLET_B_PERP_FORBIDDEN } from "../../src/core/wallet-isolation-guard";
import {
  auditGmxWalletAShortWire,
  buildGmxWalletAShortOrder,
  GMX_WALLET_A_SHORT_DEFAULT,
} from "../../src/services/adapters/gmx-v2-wallet-a-short-builder";

describe("gmx-v2-wallet-a-short-builder", () => {
  it("builds short MarketIncrease for Wallet A", () => {
    const built = buildGmxWalletAShortOrder({ sizeUsd: 10, midPriceUsd: 3500 });
    expect(built.walletA).toBe(GMX_WALLET_A_SHORT_DEFAULT);
    expect(built.payload.isLong).toBe(false);
    expect(built.wire.isLong).toBe(false);
    expect(built.wire.numbers.acceptablePrice).toBeGreaterThan(0n);
    expect(auditGmxWalletAShortWire(built.wire).ok).toBe(true);
  });

  it("rejects Wallet B as receiver", () => {
    expect(() =>
      buildGmxWalletAShortOrder({
        walletA: getAddress(GMX_WALLET_B_DEFAULT),
        sizeUsd: 10,
        midPriceUsd: 3500,
      }),
    ).toThrow(WALLET_B_PERP_FORBIDDEN);
  });

  it("auditGmxWalletAShortWire fails when isLong true", () => {
    const built = buildGmxWalletAShortOrder({ sizeUsd: 10, midPriceUsd: 3500 });
    const bad = { ...built.wire, isLong: true };
    expect(auditGmxWalletAShortWire(bad).ok).toBe(false);
  });
});
