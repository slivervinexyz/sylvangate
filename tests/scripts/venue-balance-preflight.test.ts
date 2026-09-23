import { describe, expect, it, vi } from "vitest";
import { getAddress, parseUnits, type PublicClient } from "viem";
import { GMX_USDC_ARBITRUM } from "../../src/services/adapters/gmx-v2-order-payload-constants";
import { HL_WALLET_A_DEFAULT } from "../../src/services/gmx-cross-wallet-hedge-fetch";
import { VENUE_USDAI_ARBITRUM, VENUE_WALLET_B_PRINCIPAL } from "../../src/core/venue-execution-matrix";
import { probeVenueBalances } from "../../scripts/_shared/venue-balance-preflight";

vi.mock("../../src/adapters/hl/wallet/marginChecker", () => ({
  fetchHlMainnetPerpsMargin: vi.fn(),
}));
import { fetchHlMainnetPerpsMargin } from "../../src/adapters/hl/wallet/marginChecker";

function mockClient(balances: {
  eth?: bigint;
  usdc?: bigint;
  usdai?: bigint;
}): PublicClient {
  return {
    getBalance: vi.fn().mockResolvedValue(balances.eth ?? parseUnits("0.01", 18)),
    readContract: vi.fn().mockImplementation(({ address }: { address: string }) => {
      if (address.toLowerCase() === GMX_USDC_ARBITRUM.toLowerCase()) {
        return Promise.resolve(balances.usdc ?? 0n);
      }
      if (address.toLowerCase() === VENUE_USDAI_ARBITRUM.toLowerCase()) {
        return Promise.resolve(balances.usdai ?? 0n);
      }
      return Promise.resolve(0n);
    }),
  } as unknown as PublicClient;
}

describe("venue-balance-preflight", () => {
  it("detects USDC shortfall for gmx-perp", async () => {
    const client = mockClient({ usdc: 0n });
    const result = await probeVenueBalances(client, "gmx-perp", {
      wallet: getAddress(HL_WALLET_A_DEFAULT),
      amountUsd: 1,
    });
    expect(result?.ok).toBe(false);
    expect(result?.shortfalls.some((s) => s.field === "USDC")).toBe(true);
  });

  it("detects USDai shortfall for pendle when only USDC funded", async () => {
    const client = mockClient({ usdc: parseUnits("5", 6), usdai: 0n });
    const result = await probeVenueBalances(client, "pendle-pt-dust", {
      wallet: getAddress(HL_WALLET_A_DEFAULT),
      amountUsd: 1,
    });
    expect(result?.ok).toBe(false);
    expect(result?.shortfalls.some((s) => s.field === "USDai")).toBe(true);
    expect(Number(result?.actual.USDC)).toBeGreaterThan(0);
    expect(Number(result?.actual.USDai)).toBe(0);
  });

  it("passes pendle when USDai and gas sufficient", async () => {
    const client = mockClient({ usdai: parseUnits("2", 18) });
    const result = await probeVenueBalances(client, "pendle-pt-dust", {
      wallet: getAddress(HL_WALLET_A_DEFAULT),
      amountUsd: 1,
    });
    expect(result?.ok).toBe(true);
  });

  it("detects HL margin shortfall for hyperliquid-hedge", async () => {
    vi.mocked(fetchHlMainnetPerpsMargin).mockResolvedValue({
      accountValueUsd: 0,
      withdrawableUsd: 0,
      apiOk: true,
    });
    const client = mockClient({});
    const result = await probeVenueBalances(client, "hyperliquid-hedge", {
      wallet: getAddress(HL_WALLET_A_DEFAULT),
      amountUsd: 1,
    });
    expect(result?.ok).toBe(false);
    expect(result?.shortfalls.some((s) => s.field === "hlPerpsEquityUsd")).toBe(true);
    expect(result?.hlApiOk).toBe(true);
  });

  it("fail-opens HL probe when API unavailable", async () => {
    vi.mocked(fetchHlMainnetPerpsMargin).mockResolvedValue({
      accountValueUsd: 0,
      withdrawableUsd: 0,
      apiOk: false,
    });
    const client = mockClient({});
    const result = await probeVenueBalances(client, "hyperliquid-hedge", {
      wallet: getAddress(HL_WALLET_A_DEFAULT),
      amountUsd: 1,
    });
    expect(result?.ok).toBe(true);
    expect(result?.hlApiOk).toBe(false);
  });

  it("passes gmx-gm-deposit when Wallet B has USDC", async () => {
    const client = mockClient({ usdc: parseUnits("20", 6) });
    const result = await probeVenueBalances(client, "gmx-gm-deposit", {
      wallet: getAddress(VENUE_WALLET_B_PRINCIPAL),
      amountUsd: 10,
    });
    expect(result?.ok).toBe(true);
  });
});
