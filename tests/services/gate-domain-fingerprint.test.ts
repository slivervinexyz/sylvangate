import { describe, expect, it } from "vitest";
import {
  SLIVERVINE_GATE_SEPOLIA_ADDRESS,
  computeExpectedGateDomainSeparator,
  verifyGateDomainSeparator,
} from "../../src/services/gate-domain-fingerprint";
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-chain";

describe("gate-domain-fingerprint (G11)", () => {
  it("computeExpectedGateDomainSeparator is deterministic", () => {
    const a = computeExpectedGateDomainSeparator(
      ARBITRUM_SEPOLIA_CHAIN_ID,
      SLIVERVINE_GATE_SEPOLIA_ADDRESS,
    );
    const b = computeExpectedGateDomainSeparator(
      ARBITRUM_SEPOLIA_CHAIN_ID,
      SLIVERVINE_GATE_SEPOLIA_ADDRESS,
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("verifyGateDomainSeparator passes when on-chain matches expected", async () => {
    const expected = computeExpectedGateDomainSeparator(
      ARBITRUM_SEPOLIA_CHAIN_ID,
      SLIVERVINE_GATE_SEPOLIA_ADDRESS,
    );
    const verdict = await verifyGateDomainSeparator({
      chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
      gateAddress: SLIVERVINE_GATE_SEPOLIA_ADDRESS,
      onChainSeparator: expected,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it("verifyGateDomainSeparator fails on DOMAIN_SEPARATOR_MISMATCH", async () => {
    const expected = computeExpectedGateDomainSeparator(
      ARBITRUM_SEPOLIA_CHAIN_ID,
      SLIVERVINE_GATE_SEPOLIA_ADDRESS,
    );
    const verdict = await verifyGateDomainSeparator({
      chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
      gateAddress: SLIVERVINE_GATE_SEPOLIA_ADDRESS,
      onChainSeparator: `0x${"ab".repeat(32)}`,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain("DOMAIN_SEPARATOR_MISMATCH");
    expect(verdict.expected).toBe(expected);
  });
});
