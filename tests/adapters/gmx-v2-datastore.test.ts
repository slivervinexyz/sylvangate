import { describe, expect, it } from "vitest";
import { hashString, hashData, fetchSplitBorrowRates } from "../../src/services/adapters/gmx-v2-datastore";

describe("gmx-v2-datastore", () => {
  it("hashString matches ethers keccak256 abi encode", () => {
    const openInterest = hashString("OPEN_INTEREST");
    expect(openInterest).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hashString("OPEN_INTEREST")).toBe(openInterest);
  });

  it("hashData builds deterministic market keys", () => {
    const base = hashString("LONG_INTEREST_IN_TOKENS");
    const key = hashData(
      ["bytes32", "address", "address"],
      [base, "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"],
    );
    expect(key).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("fetchSplitBorrowRates falls back to markets/info rates", async () => {
    const rates = await fetchSplitBorrowRates({
      market: {
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        longToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        shortToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      },
      opts: {
        fetchFn: async () => new Response("rpc down", { status: 503 }),
      },
      fallback: {
        borrowingRateLong: "53590812552218240676133776000",
        borrowingRateShort: "0",
        fundingRateLong: "68639423808362398485884064000",
        fundingRateShort: "-79174241446722346815838224330",
      },
    });
    expect(rates.source).toBe("markets-info-fallback");
    expect(rates.longBorrowRateHourly).toBeGreaterThan(0);
    expect(rates.shortBorrowRateHourly).toBe(0);
  });
});
