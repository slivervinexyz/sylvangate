import { describe, expect, it } from "vitest";
import {
  HL_AGENT_TYPES,
  HL_APPROVE_AGENT_TYPES,
  HL_EXCHANGE_DOMAIN,
  HL_L1_CHAIN_ID,
  HL_USER_SIGNED_CHAIN_ID,
  HL_ZERO_ADDRESS,
  buildUserSignedDomain,
  chainIdHexToNumber,
  normalizeChainIdHex,
} from "../../../src/adapters/hl/auth";

describe("hl/auth — EIP-712 domains & types", () => {
  it("defines Exchange L1 domain with chainId 1337", () => {
    expect(HL_EXCHANGE_DOMAIN).toEqual({
      name: "Exchange",
      version: "1",
      chainId: HL_L1_CHAIN_ID,
      verifyingContract: HL_ZERO_ADDRESS,
    });
    expect(HL_L1_CHAIN_ID).toBe(1337);
  });

  it("defines Agent typed fields for phantom L1 signing", () => {
    expect(HL_AGENT_TYPES.Agent).toEqual([
      { name: "source", type: "string" },
      { name: "connectionId", type: "bytes32" },
    ]);
  });

  it("builds user-signed domain from signatureChainId hex", () => {
    expect(buildUserSignedDomain(HL_USER_SIGNED_CHAIN_ID)).toEqual({
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 0x66eee,
      verifyingContract: HL_ZERO_ADDRESS,
    });
  });

  it("normalizes wallet chain ids for dynamic EIP-712 domains", () => {
    expect(normalizeChainIdHex("0x3e6")).toBe("0x3e6");
    expect(chainIdHexToNumber("0x3e6")).toBe(998);
    expect(buildUserSignedDomain("0x3e6").chainId).toBe(998);
  });

  it("defines ApproveAgent / session-key delegation types", () => {
    expect(HL_APPROVE_AGENT_TYPES["HyperliquidTransaction:ApproveAgent"]).toEqual([
      { name: "hyperliquidChain", type: "string" },
      { name: "agentAddress", type: "address" },
      { name: "agentName", type: "string" },
      { name: "nonce", type: "uint64" },
    ]);
  });
});
