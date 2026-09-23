import { Wallet } from "ethers";
import { resolveHlTestnetDryRunPrivateKey } from "../../../src/env/hl-testnet-key";

export const TEST_PRIVATE_KEY = resolveHlTestnetDryRunPrivateKey();
export const TEST_AGENT_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export const PASSING_PRE_TRADE = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
  latencyMs: 50,
  expectedSlippage: 0.0005,
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const testWallet = new Wallet(TEST_PRIVATE_KEY);
