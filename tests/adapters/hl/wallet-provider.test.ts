import { describe, expect, it } from "vitest";
import {
  HL_HYPEREVM_TESTNET_CHAIN_CONFIG,
  HL_HYPEREVM_TESTNET_CHAIN_ID_HEX,
  createBrowserEip712Signer,
  ensureHyperEvmTestnetChain,
  fetchWalletChainIdHex,
} from "../../../src/adapters/hl/wallet-provider";

describe("wallet-provider HyperEVM network switch", () => {
  it("ensureHyperEvmTestnetChain switches when not on 0x3e6", async () => {
    let chainId = "0x1";
    const calls: string[] = [];
    const provider = {
      request: async (args: { method: string; params?: unknown[] }) => {
        calls.push(args.method);
        if (args.method === "eth_chainId") return chainId;
        if (args.method === "wallet_switchEthereumChain") {
          chainId = HL_HYPEREVM_TESTNET_CHAIN_ID_HEX;
          return null;
        }
        throw new Error(`unexpected ${args.method}`);
      },
    };

    await expect(ensureHyperEvmTestnetChain(provider)).resolves.toBe("0x3e6");
    expect(calls).toContain("wallet_switchEthereumChain");
  });

  it("ensureHyperEvmTestnetChain adds chain on 4902 then returns 0x3e6", async () => {
    let chainId = "0x1";
    const provider = {
      request: async (args: { method: string; params?: unknown[] }) => {
        if (args.method === "eth_chainId") return chainId;
        if (args.method === "wallet_switchEthereumChain") {
          const err = new Error("Unrecognized chain") as Error & { code: number };
          err.code = 4902;
          throw err;
        }
        if (args.method === "wallet_addEthereumChain") {
          expect(args.params?.[0]).toEqual(HL_HYPEREVM_TESTNET_CHAIN_CONFIG);
          chainId = HL_HYPEREVM_TESTNET_CHAIN_ID_HEX;
          return null;
        }
        throw new Error(`unexpected ${args.method}`);
      },
    };

    await expect(ensureHyperEvmTestnetChain(provider)).resolves.toBe("0x3e6");
  });

  it("fetchWalletChainIdHex reads eth_chainId and normalizes hex", async () => {
    const provider = {
      request: async (args: { method: string }) => {
        if (args.method === "eth_chainId") return "0x3e6";
        throw new Error(`unexpected method ${args.method}`);
      },
    };
    await expect(fetchWalletChainIdHex(provider)).resolves.toBe("0x3e6");
  });

  it("createBrowserEip712Signer keeps Exchange L1 domain chainId 1337 (SDK canonical)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const provider = {
      request: async (args: { method: string; params?: unknown[] }) => {
        if (args.method === "eth_chainId") return "0x3e6";
        if (args.method === "eth_signTypedData_v4") {
          capturedPayload = JSON.parse(String(args.params?.[1])) as Record<string, unknown>;
          return "0x" + "11".repeat(65);
        }
        throw new Error(`unexpected method ${args.method}`);
      },
    };
    const signer = createBrowserEip712Signer(
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      provider,
    );
    await signer.signTypedData(
      {
        name: "Exchange",
        version: "1",
        chainId: 1337,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      },
      { Agent: [{ name: "source", type: "string" }] },
      { source: "b" },
    );
    expect((capturedPayload?.domain as { chainId?: number })?.chainId).toBe(1337);
  });

  it("createBrowserEip712Signer syncs wallet chainId for user-signed approveAgent domain", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const provider = {
      request: async (args: { method: string; params?: unknown[] }) => {
        if (args.method === "eth_chainId") return "0x3e6";
        if (args.method === "eth_signTypedData_v4") {
          capturedPayload = JSON.parse(String(args.params?.[1])) as Record<string, unknown>;
          return "0x" + "11".repeat(65);
        }
        throw new Error(`unexpected method ${args.method}`);
      },
    };
    const signer = createBrowserEip712Signer(
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      provider,
    );
    await signer.signTypedData(
      {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 0x66eee,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      },
      {
        "HyperliquidTransaction:ApproveAgent": [
          { name: "hyperliquidChain", type: "string" },
          { name: "agentAddress", type: "address" },
          { name: "agentName", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      },
      { hyperliquidChain: "Testnet", agentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", agentName: "BeDeltaAgent", nonce: 1 },
    );
    expect((capturedPayload?.domain as { chainId?: number })?.chainId).toBe(998);
  });
});
