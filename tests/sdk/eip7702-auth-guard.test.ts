import { describe, expect, it } from "vitest";
import {
  decodeEip7702Authorization,
  EIP7702_CODES,
  evaluateEip7702AuthGuard,
} from "../../src/sdk/exomesh-agentic-wallet-guard/eip7702-auth-guard";

const TRUSTED_IMPL = "0xfd98cadb7018f692ec58cd4359e0c0399f4f8781";
const MALICIOUS_IMPL = "0x1111111111111111111111111111111111111111";

const BASE_TUPLE = {
  chainId: 42161,
  address: TRUSTED_IMPL,
  nonce: 1n,
  yParity: 1,
  r: "0x" + "ab".repeat(32),
  s: "0x" + "cd".repeat(32),
};

describe("eip7702-auth-guard", () => {
  it("PASS — whitelisted implementation on expected chain", () => {
    const auth = decodeEip7702Authorization(BASE_TUPLE);
    const verdict = evaluateEip7702AuthGuard(auth, {
      expectedChainId: 42161,
      trustedImplementations: [TRUSTED_IMPL],
      blockedImplementations: [MALICIOUS_IMPL],
    });

    expect(verdict.passed).toBe(true);
    expect(verdict.zeroGasBlocked).toBe(false);
    expect(verdict.normalizedImplementation).toBe(TRUSTED_IMPL.toLowerCase());
  });

  it("REJECT — malicious injected implementation address", () => {
    const auth = decodeEip7702Authorization({
      ...BASE_TUPLE,
      address: MALICIOUS_IMPL,
    });
    const verdict = evaluateEip7702AuthGuard(auth, {
      expectedChainId: 42161,
      trustedImplementations: [TRUSTED_IMPL],
      blockedImplementations: [MALICIOUS_IMPL],
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.zeroGasBlocked).toBe(true);
    expect(verdict.code).toBe(EIP7702_CODES.MALICIOUS_INJECTION);
  });

  it("REJECT — untrusted implementation not in allow matrix", () => {
    const auth = decodeEip7702Authorization({
      ...BASE_TUPLE,
      address: "0x2222222222222222222222222222222222222222",
    });
    const verdict = evaluateEip7702AuthGuard(auth, {
      expectedChainId: 42161,
      trustedImplementations: [TRUSTED_IMPL],
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.code).toBe(EIP7702_CODES.UNTRUSTED_IMPLEMENTATION);
  });
});
