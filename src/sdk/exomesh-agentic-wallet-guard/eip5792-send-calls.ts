/**
 * SPDX-License-Identifier: Apache-2.0
 * EIP-5792 wallet_sendCalls — unfold calls[] into send-tx risk (one INTENT_RING attempt).
 */
import { evaluateRetailIntentGate, evaluateRpcTransportProtocol, resolveVenueBitFromContract } from "./guard-engine";
import { evaluateRetailRisk } from "./risk-evaluator";
import type { RetailGuardConfig, RetailGuardRejectPayload } from "./types";

export const EIP5792_WALLET_SEND_CALLS = "wallet_sendCalls";

const EMPTY_BATCH: RetailGuardRejectPayload = {
  code: "SEND_CALLS_BATCH_REJECTED",
  message: "SEND_CALLS_BATCH_REJECTED:empty_or_malformed_calls",
  plainTextWarning:
    "ALERT: EIP-5792 wallet_sendCalls batch rejected — empty or malformed calls[] (0-Gas pre-broadcast guard).",
};

const SKIP_OPTS = { skipTransport: true, skipIntentGate: true } as const;
const TX_PARAMS: [unknown] = [null];

type TxEnv = { to?: string; data?: string; value?: string };

function rawCalls(params: unknown[]): unknown[] | null {
  const body = params[0];
  if (!body || typeof body !== "object") return null;
  const calls = (body as { calls?: unknown }).calls;
  return Array.isArray(calls) ? calls : null;
}

/** Parse EIP-5792 `wallet_sendCalls` params[0].calls into tx envelopes. */
export function parseWalletSendCalls(params: unknown[]): TxEnv[] | null {
  const calls = rawCalls(params);
  if (!calls) return null;
  const len = calls.length;
  const out: TxEnv[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const tx = calls[i];
    if (!tx || typeof tx !== "object") return null;
    out[i] = tx as TxEnv;
  }
  return out;
}

export function evaluateEip5792WalletSendCalls(
  config: RetailGuardConfig,
  params: unknown[],
): RetailGuardRejectPayload | null {
  const calls = rawCalls(params);
  if (!calls || calls.length === 0) return EMPTY_BATCH;

  const transport = evaluateRpcTransportProtocol(config);
  if (transport) return transport;

  let venueBits = 0;
  const len = calls.length;
  for (let i = 0; i < len; i++) {
    const tx = calls[i];
    if (!tx || typeof tx !== "object") return EMPTY_BATCH;
    TX_PARAMS[0] = tx;
    const reject = evaluateRetailRisk(config, "eth_sendTransaction", TX_PARAMS, SKIP_OPTS);
    if (reject) return reject;
    venueBits |= resolveVenueBitFromContract((tx as TxEnv).to, config.contractVenueIndex);
  }
  return evaluateRetailIntentGate(config, venueBits);
}
