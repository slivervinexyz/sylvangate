import { Wallet, verifyTypedData } from "ethers";
import { describe, expect, it } from "vitest";
import {
  HL_AGENT_TYPES,
  HL_EXCHANGE_DOMAIN,
  HL_L1_CHAIN_ID,
  HL_ZERO_ADDRESS,
  buildExchangeAgentMessage,
  buildExchangeDomain,
  createL1ActionHash,
  signHyperliquidAction,
  splitHyperliquidSignature,
} from "../../../src/adapters/hl/auth";
import { TEST_MASTER_ADDRESS, TEST_PRIVATE_KEY } from "./auth-lib/auth-fixtures";

describe("hl/auth — L1 action hash & exchange signing", () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  const sampleAction = {
    type: "cancel",
    cancels: [{ a: 0, o: 12345 }],
  };
  const fixedNonce = 1_700_000_000_000;

  it("creates deterministic L1 action hash (connectionId)", () => {
    const hash = createL1ActionHash({ action: sampleAction, nonce: fixedNonce });
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(createL1ActionHash({ action: sampleAction, nonce: fixedNonce })).toBe(hash);
  });

  it("builds phantom Agent message for mainnet source 'a'", () => {
    const message = buildExchangeAgentMessage({
      action: sampleAction,
      nonce: fixedNonce,
      isTestnet: false,
    });
    expect(message.source).toBe("a");
    expect(message.connectionId).toBe(
      createL1ActionHash({ action: sampleAction, nonce: fixedNonce }),
    );
  });

  it("buildExchangeDomain always uses SDK canonical L1 chainId 1337", () => {
    expect(buildExchangeDomain("0x3e6")).toEqual({
      name: "Exchange",
      version: "1",
      chainId: HL_L1_CHAIN_ID,
      verifyingContract: HL_ZERO_ADDRESS,
    });
    expect(buildExchangeDomain().chainId).toBe(HL_L1_CHAIN_ID);
  });

  it("signHyperliquidAction uses Exchange domain chainId 1337 (SDK canonical)", async () => {
    const walletChainId = "0x3e6";
    const signature = await signHyperliquidAction(wallet, sampleAction, fixedNonce, {
      isTestnet: true,
      signatureChainId: walletChainId,
    });
    const agentMessage = buildExchangeAgentMessage({
      action: sampleAction,
      nonce: fixedNonce,
      isTestnet: true,
    });
    const recovered = verifyTypedData(
      HL_EXCHANGE_DOMAIN,
      HL_AGENT_TYPES,
      agentMessage,
      signature,
    );
    expect(recovered).toBe(TEST_MASTER_ADDRESS);
  });

  it("signHyperliquidAction returns recoverable EIP-712 signature", async () => {
    const signature = await signHyperliquidAction(wallet, sampleAction, fixedNonce);
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);

    const agentMessage = buildExchangeAgentMessage({
      action: sampleAction,
      nonce: fixedNonce,
    });
    const recovered = verifyTypedData(
      HL_EXCHANGE_DOMAIN,
      HL_AGENT_TYPES,
      agentMessage,
      signature,
    );
    expect(recovered).toBe(TEST_MASTER_ADDRESS);

    const parts = splitHyperliquidSignature(signature);
    expect(parts.r).toMatch(/^0x/);
    expect(parts.s).toMatch(/^0x/);
    expect(parts.v).toBeGreaterThanOrEqual(27);
  });

  it("uses testnet source 'b' when isTestnet is true", async () => {
    const message = buildExchangeAgentMessage({
      action: sampleAction,
      nonce: fixedNonce,
      isTestnet: true,
    });
    expect(message.source).toBe("b");

    const signature = await signHyperliquidAction(wallet, sampleAction, fixedNonce, {
      isTestnet: true,
    });
    const recovered = verifyTypedData(
      HL_EXCHANGE_DOMAIN,
      HL_AGENT_TYPES,
      message,
      signature,
    );
    expect(recovered).toBe(TEST_MASTER_ADDRESS);
  });
});
