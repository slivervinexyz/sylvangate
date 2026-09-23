import type { SessionKeyAgentResult } from "../../../../src/adapters/hl/auth";

export const MASTER_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export const SAMPLE_AGENT: SessionKeyAgentResult = {
  action: {
    type: "approveAgent",
    signatureChainId: "0x3e6",
    hyperliquidChain: "Testnet",
    agentAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    agentName: "BeDeltaAgent",
    nonce: 1_700_000_000_000,
  },
  signature: "0x" + "ab".repeat(65),
  agentAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  expiresAt: 1_700_086_400_000,
  nonce: 1_700_000_000_000,
  hyperliquidChain: "Testnet",
};

export function mockIndexedAgentFetch(
  exchangeResponse: unknown,
): typeof fetch {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { type?: string };
    if (body.type === "extraAgents") {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            name: "BeDeltaAgent",
            address: SAMPLE_AGENT.agentAddress,
            validUntil: Date.now() + 60_000,
          },
        ],
      } as Response;
    }
    if (body.type === "clearinghouseState") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          marginSummary: { accountValue: "1000" },
          withdrawable: "500",
        }),
      } as Response;
    }
    return exchangeResponse as Response;
  };
}
