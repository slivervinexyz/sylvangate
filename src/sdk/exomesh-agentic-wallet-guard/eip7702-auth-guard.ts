/**
 * SPDX-License-Identifier: Apache-2.0
 * EIP-7702 EOA Code Authorization Firewall — trusted implementation matrix gate.
 */

/** EIP-7702 authorization tuple `(chainId, address, nonce, yParity, r, s)`. */
export interface Eip7702Authorization {
  chainId: number;
  address: string;
  nonce: bigint;
  yParity: number;
  r: string;
  s: string;
}

export const EIP7702_CODES = {
  INVALID_TUPLE: "INVALID_TUPLE",
  CHAIN_MISMATCH: "CHAIN_MISMATCH",
  UNTRUSTED_IMPLEMENTATION: "UNTRUSTED_IMPLEMENTATION",
  MALICIOUS_INJECTION: "MALICIOUS_INJECTION",
} as const;

export type Eip7702RejectCode = (typeof EIP7702_CODES)[keyof typeof EIP7702_CODES];

export interface Eip7702AuthGuardConfig {
  expectedChainId: number;
  trustedImplementations: readonly string[];
  blockedImplementations?: readonly string[];
}

export interface Eip7702AuthVerdict {
  passed: boolean;
  zeroGasBlocked: boolean;
  code?: Eip7702RejectCode;
  message?: string;
  normalizedImplementation: string;
}

const HEX40 = /^0x[a-fA-F0-9]{40}$/;

function normAddr(addr: string): string {
  return addr.trim().toLowerCase();
}

function isHex40(addr: string): boolean {
  return HEX40.test(addr.trim());
}

/** Decode raw EIP-7702 tuple fields from RPC / calldata envelope. */
export function decodeEip7702Authorization(raw: {
  chainId: number | string;
  address: string;
  nonce: bigint | number | string;
  yParity: number | string;
  r: string;
  s: string;
}): Eip7702Authorization | null {
  const chainId = typeof raw.chainId === "string" ? Number(raw.chainId) : raw.chainId;
  if (!Number.isFinite(chainId) || chainId <= 0) return null;
  if (!isHex40(raw.address)) return null;
  const nonce =
    typeof raw.nonce === "bigint"
      ? raw.nonce
      : BigInt(typeof raw.nonce === "string" ? raw.nonce : Math.trunc(raw.nonce));
  const yParity = typeof raw.yParity === "string" ? Number(raw.yParity) : raw.yParity;
  if (yParity !== 0 && yParity !== 1) return null;
  const r = raw.r.trim();
  const s = raw.s.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(r) || !/^0x[a-fA-F0-9]{64}$/.test(s)) return null;
  return { chainId, address: normAddr(raw.address), nonce, yParity, r, s };
}

/** Verify EIP-7702 delegation target against trusted bytecode/address invariant matrix. */
export function evaluateEip7702AuthGuard(
  auth: Eip7702Authorization | null,
  config: Eip7702AuthGuardConfig,
): Eip7702AuthVerdict {
  const empty = {
    passed: false,
    zeroGasBlocked: true,
    normalizedImplementation: "",
  };

  if (!auth) {
    return {
      ...empty,
      code: EIP7702_CODES.INVALID_TUPLE,
      message: "INVALID_TUPLE:malformed EIP-7702 authorization",
    };
  }

  const impl = normAddr(auth.address);
  if (auth.chainId !== config.expectedChainId) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: EIP7702_CODES.CHAIN_MISMATCH,
      message: `CHAIN_MISMATCH:auth=${auth.chainId} expected=${config.expectedChainId}`,
      normalizedImplementation: impl,
    };
  }

  const blocked = (config.blockedImplementations ?? []).map(normAddr);
  if (blocked.includes(impl)) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: EIP7702_CODES.MALICIOUS_INJECTION,
      message: `MALICIOUS_INJECTION:blocked=${impl}`,
      normalizedImplementation: impl,
    };
  }

  const trusted = config.trustedImplementations.map(normAddr);
  if (!trusted.includes(impl)) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: EIP7702_CODES.UNTRUSTED_IMPLEMENTATION,
      message: `UNTRUSTED_IMPLEMENTATION:${impl}`,
      normalizedImplementation: impl,
    };
  }

  return {
    passed: true,
    zeroGasBlocked: false,
    normalizedImplementation: impl,
  };
}
