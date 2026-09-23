import { Wallet, verifyTypedData } from "ethers";
import { describe, expect, it } from "vitest";
import {
  HL_APPROVE_AGENT_TYPES,
  HL_SESSION_KEY_AGENT_NAME,
  HL_USER_SIGNED_CHAIN_ID,
  buildUserSignedDomain,
  createSessionKeyAgent,
  verifySessionKeyValidity,
} from "../../../src/adapters/hl/auth";
import {
  TEST_AGENT_ADDRESS,
  TEST_MASTER_ADDRESS,
  TEST_PRIVATE_KEY,
} from "./auth-lib/auth-fixtures";

describe("hl/auth — session key agent authorization", () => {
  const masterWallet = new Wallet(TEST_PRIVATE_KEY);
  const durationMs = 86_400_000;
  const fixedNonce = 1_700_000_000_000;

  it("createSessionKeyAgent signs ApproveAgent user-signed action", async () => {
    const result = await createSessionKeyAgent(
      masterWallet,
      TEST_AGENT_ADDRESS,
      durationMs,
      { nonce: fixedNonce },
    );

    expect(result.action).toEqual({
      type: "approveAgent",
      signatureChainId: HL_USER_SIGNED_CHAIN_ID,
      hyperliquidChain: "Mainnet",
      agentAddress: TEST_AGENT_ADDRESS.toLowerCase(),
      agentName: HL_SESSION_KEY_AGENT_NAME,
      nonce: fixedNonce,
    });
    expect(result.expiresAt).toBe(fixedNonce + durationMs);
    expect(result.signature).toMatch(/^0x[0-9a-f]{130}$/i);

    const domain = buildUserSignedDomain(HL_USER_SIGNED_CHAIN_ID);
    const recovered = verifyTypedData(
      domain,
      HL_APPROVE_AGENT_TYPES,
      {
        hyperliquidChain: result.action.hyperliquidChain,
        agentAddress: result.action.agentAddress,
        agentName: result.action.agentName,
        nonce: result.action.nonce,
      },
      result.signature,
    );
    expect(recovered).toBe(TEST_MASTER_ADDRESS);
  });

  it("createSessionKeyAgent accepts dynamic wallet signatureChainId (HL testnet 998)", async () => {
    const walletChainId = "0x3e6";
    const result = await createSessionKeyAgent(
      masterWallet,
      TEST_AGENT_ADDRESS,
      durationMs,
      { nonce: fixedNonce, isTestnet: true, signatureChainId: walletChainId },
    );

    expect(result.action.signatureChainId).toBe("0x3e6");
    expect(result.action.hyperliquidChain).toBe("Testnet");
    const domain = buildUserSignedDomain(walletChainId);
    expect(domain.chainId).toBe(998);
    const recovered = verifyTypedData(
      domain,
      HL_APPROVE_AGENT_TYPES,
      {
        hyperliquidChain: result.action.hyperliquidChain,
        agentAddress: result.action.agentAddress,
        agentName: result.action.agentName,
        nonce: result.action.nonce,
      },
      result.signature,
    );
    expect(recovered).toBe(TEST_MASTER_ADDRESS);
  });

  it("verifySessionKeyValidity accepts valid future expiry", () => {
    const future = Date.now() + 60_000;
    expect(verifySessionKeyValidity(TEST_AGENT_ADDRESS, future)).toBe(true);
  });

  it("verifySessionKeyValidity rejects expired or malformed address", () => {
    expect(verifySessionKeyValidity(TEST_AGENT_ADDRESS, Date.now() - 1)).toBe(false);
    expect(verifySessionKeyValidity("not-an-address", Date.now() + 60_000)).toBe(false);
  });
});
