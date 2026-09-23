import {
  EIP712_DOMAIN_NAME,
  SLIVERVINE_GATE_ADDRESS,
} from "../../../src/sdk";

export const DIGEST =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const AGENT = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const NOW = 1_700_000_000_000;
export const WALLET = "0xcccccccccccccccccccccccccccccccccccccccc";

export function clearSoil(symbol = "ETH-PERP") {
  return {
    symbol,
    hlSpot: 100,
    hlPerp: 100,
    dydxPerp: 100,
    depthUsd: 1_000_000,
    isTestnet: true as const,
  };
}

export function validSession() {
  return {
    agentAddress: AGENT,
    maxOrderClipUsd: 30,
    expiresAtMs: NOW + 86_400_000,
    approvedAtMs: NOW,
  };
}

export function validAttestation() {
  return {
    digest: DIGEST,
    expiresAtMs: NOW + 60_000,
    sig: `0x${"11".repeat(65)}`,
    verifyingContract: SLIVERVINE_GATE_ADDRESS,
    domainName: EIP712_DOMAIN_NAME,
  };
}
