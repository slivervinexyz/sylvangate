import {
  HL_L1_CHAIN_ID,
  HL_SESSION_KEY_AGENT_NAME,
  type SessionKeyEip712Stub,
  type SessionKeyOrderPayload,
} from "./session-key-types";
import { assertSessionKeyStubAllowed } from "./session-key-stub-guard";

/** Build Hyperliquid Session Key EIP-712 stub (no ethers — Workers-safe). */
export function buildSessionKeyEip712Stub(
  payload: SessionKeyOrderPayload,
  nonce: number,
  connectionId: string,
  isTestnet = false,
): SessionKeyEip712Stub {
  return {
    domain: {
      name: "Exchange",
      version: "1",
      chainId: HL_L1_CHAIN_ID,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    types: {
      Agent: [
        { name: "source", type: "string" },
        { name: "connectionId", type: "bytes32" },
      ],
    },
    message: {
      source: isTestnet ? "b" : "a",
      connectionId,
      action: {
        type: "order",
        orders: [
          {
            a: payload.asset,
            b: payload.isBuy,
            p: payload.limitPx,
            s: payload.sz,
            r: payload.reduceOnly,
            t: payload.orderType,
          },
        ],
        grouping: "na",
      },
      nonce,
      agentName: HL_SESSION_KEY_AGENT_NAME,
    },
  };
}

/**
 * @deprecated Test/sandbox only — production HL orders must use `executeHlSessionKeyOrder`.
 * Blocked when `IS_MAINNET=true` (see `session-key-stub-guard.ts`).
 */
export async function stubSignSessionKeyPayload(
  eip712: SessionKeyEip712Stub,
): Promise<string> {
  assertSessionKeyStubAllowed();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(eip712)),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

/** Workers-native SHA-256 builder for authentic 32-byte Hex ConnectionId */
export async function buildConnectionId(
  payload: SessionKeyOrderPayload,
  nonce: number,
): Promise<string> {
  const seed = `${payload.asset}:${payload.limitPx}:${payload.sz}:${payload.reduceOnly}:${nonce}`;
  const msgUint8 = new TextEncoder().encode(seed);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}
