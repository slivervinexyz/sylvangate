/** GMX micro-fill — non-Alchemy RPC fallback for revert replay + call trace diagnostics. */
import { type Hex } from "viem";
import { postArbitrumJsonRpc } from "./arbitrum-rpc-fallback";
import { decodeGmxRevertData } from "./gmx-micro-fill-revert-decode";
import { interpretGmxRevertData } from "./gmx-error-interpreter";
import { labelGmxSyntheticsError, type GmxSyntheticsErrorLabel } from "./gmx-synthetics-error-labels";
import {
  resolveGmxDiagnosticRpcProviders,
  scrapeJsonRpcRevertData,
} from "./gmx-micro-fill-rpc-providers";
import {
  extractTraceRevertHint,
  isSilentRevertHex,
  type GmxTraceRevertHint,
} from "./gmx-micro-fill-trace-parse";

export type GmxFailedTxDiagnostics = {
  summary: string;
  decodedError?: string;
  errorLabel?: GmxSyntheticsErrorLabel;
  rawData?: Hex;
  rpcUrl?: string;
  traceHint?: string;
  callPath?: string;
  source?: "eth_call" | "debug_trace" | "trace_transaction";
};

export type GmxTxReplayFields = {
  from: Hex;
  to: Hex;
  input: Hex;
  value: bigint;
  gas: bigint;
  blockTag: Hex | "latest";
};

export {
  isAlchemyRpc,
  resolveGmxDiagnosticRpcProviders,
  scrapeJsonRpcRevertData,
} from "./gmx-micro-fill-rpc-providers";
export { extractTraceRevertHint, isSilentRevertHex } from "./gmx-micro-fill-trace-parse";
export { probeIsolatedGmxCreateOrderRevert, formatGmxIsolatedProbeResult } from "./gmx-error-isolated-probe";
export {
  interpretGmxRevertData,
  interpretGmxViemError,
  formatGmxInterpretedError,
  type GmxInterpretedError,
  type GmxInterpretContext,
} from "./gmx-error-interpreter";

function rankDiagnostics(a: GmxFailedTxDiagnostics, b: GmxFailedTxDiagnostics): GmxFailedTxDiagnostics {
  const score = (d: GmxFailedTxDiagnostics) => {
    const sourceBoost = d.source === "debug_trace" || d.source === "trace_transaction" ? 2 : 0;
    return (d.errorLabel ? 8 : 0) + (d.decodedError ? 4 : 0)
      + (!isSilentRevertHex(d.rawData) ? 2 : 0) + (d.traceHint ? 1 : 0) + sourceBoost;
  };
  return score(a) >= score(b) ? a : b;
}

function buildDiagnostics(input: {
  rawData?: Hex;
  decodedError?: string;
  rpcUrl?: string;
  traceHint?: string;
  callPath?: string;
  source?: GmxFailedTxDiagnostics["source"];
}): GmxFailedTxDiagnostics {
  const stripped = input.decodedError?.replace(/^\[GMX:[^\]]+\]\s*/, "");
  const errorLabel = stripped ? labelGmxSyntheticsError(stripped) : undefined;
  const parts: string[] = [];
  if (input.decodedError) parts.push(input.decodedError);
  else if (errorLabel) parts.push(`[GMX:${errorLabel}]`);
  if (input.rawData && !isSilentRevertHex(input.rawData)) parts.push(`rawData=${input.rawData}`);
  if (input.traceHint) parts.push(`trace=${input.traceHint}`);
  if (input.callPath) parts.push(`path=${input.callPath}`);
  if (input.rpcUrl) parts.push(`rpc=${input.rpcUrl}`);
  if (input.source) parts.push(`via=${input.source}`);
  return {
    summary: parts.length ? parts.join(" | ") : "silent revert (no custom error data)",
    decodedError: input.decodedError,
    errorLabel,
    rawData: input.rawData,
    rpcUrl: input.rpcUrl,
    traceHint: input.traceHint,
    callPath: input.callPath,
    source: input.source,
  };
}

export function needsForcedCallTrace(best?: GmxFailedTxDiagnostics): boolean {
  if (!best) return true;
  if (best.summary.includes("silent revert")) return true;
  if (isSilentRevertHex(best.rawData)) return true;
  if (best.rawData && !best.decodedError) return true;
  return false;
}

function traceHintToDiagnostics(hint: GmxTraceRevertHint, rpcUrl: string, source: GmxFailedTxDiagnostics["source"]): GmxFailedTxDiagnostics {
  const interpreted = hint.rawData ? interpretGmxRevertData(hint.rawData) : undefined;
  const decodedError = interpreted && !interpreted.silent ? interpreted.decoded : undefined;
  const traceHint = hint.hint ?? (hint.callPath ? `revert at ${hint.callPath}` : undefined);
  return buildDiagnostics({
    rawData: hint.rawData,
    decodedError,
    traceHint,
    callPath: hint.callPath,
    rpcUrl,
    source,
  });
}

async function postTraceRpc(
  rpcUrl: string,
  body: unknown,
  fetchFn?: typeof fetch,
): Promise<unknown | null> {
  return postArbitrumJsonRpc(body, { fetchFn, preferredRpc: rpcUrl, providers: [rpcUrl] });
}

export async function replayGmxTxEthCall(input: {
  rpcUrl: string;
  tx: GmxTxReplayFields;
  fetchFn?: typeof fetch;
}): Promise<GmxFailedTxDiagnostics | undefined> {
  const call = {
    from: input.tx.from,
    to: input.tx.to,
    data: input.tx.input,
    value: `0x${input.tx.value.toString(16)}`,
    gas: `0x${input.tx.gas.toString(16)}`,
  };
  const json = await postArbitrumJsonRpc(
    { jsonrpc: "2.0", id: "gmx-replay", method: "eth_call", params: [call, input.tx.blockTag] },
    { fetchFn: input.fetchFn, preferredRpc: input.rpcUrl, providers: [input.rpcUrl], allowJsonRpcError: true },
  );
  const rawData = scrapeJsonRpcRevertData(json);
  if (!rawData || isSilentRevertHex(rawData)) {
    return buildDiagnostics({ rawData: rawData as Hex | undefined, rpcUrl: input.rpcUrl, source: "eth_call" });
  }
  const decodedError = decodeGmxRevertData(rawData) ?? undefined;
  return buildDiagnostics({ rawData, decodedError, rpcUrl: input.rpcUrl, source: "eth_call" });
}

export async function fetchGmxTxCallTrace(input: {
  rpcUrl: string;
  txHash: Hex;
  fetchFn?: typeof fetch;
}): Promise<GmxFailedTxDiagnostics | undefined> {
  const debugJson = await postTraceRpc(input.rpcUrl, {
    jsonrpc: "2.0",
    id: "gmx-trace",
    method: "debug_traceTransaction",
    params: [input.txHash, { tracer: "callTracer", timeout: "30s" }],
  }, input.fetchFn);
  const debugResult = debugJson && typeof debugJson === "object" && !(debugJson as { error?: unknown }).error
    ? (debugJson as { result?: unknown }).result
    : undefined;
  const debugHint = debugResult ? extractTraceRevertHint(debugResult) : undefined;
  if (debugHint) return traceHintToDiagnostics(debugHint, input.rpcUrl, "debug_trace");

  const parityJson = await postTraceRpc(input.rpcUrl, {
    jsonrpc: "2.0",
    id: "gmx-trace-tx",
    method: "trace_transaction",
    params: [input.txHash],
  }, input.fetchFn);
  if (!parityJson || typeof parityJson !== "object" || (parityJson as { error?: unknown }).error) return undefined;
  const parityHint = extractTraceRevertHint((parityJson as { result?: unknown }).result);
  if (!parityHint) return undefined;
  return traceHintToDiagnostics(parityHint, input.rpcUrl, "trace_transaction");
}

export async function diagnoseGmxFailedTransaction(input: {
  tx: GmxTxReplayFields;
  txHash: Hex;
  primaryRpc?: string;
  fetchFn?: typeof fetch;
  primaryReplay?: GmxFailedTxDiagnostics;
}): Promise<GmxFailedTxDiagnostics | undefined> {
  let best = input.primaryReplay;
  const providers = resolveGmxDiagnosticRpcProviders(input.primaryRpc);
  for (const rpcUrl of providers) {
    const replay = await replayGmxTxEthCall({ rpcUrl, tx: input.tx, fetchFn: input.fetchFn });
    if (replay) best = best ? rankDiagnostics(best, replay) : replay;
    if (best?.decodedError && !isSilentRevertHex(best.rawData)) break;
  }
  if (!needsForcedCallTrace(best)) return best;
  for (const rpcUrl of providers) {
    const traced = await fetchGmxTxCallTrace({ rpcUrl, txHash: input.txHash, fetchFn: input.fetchFn });
    if (traced) best = best ? rankDiagnostics(best, traced) : traced;
    if (best?.decodedError && !isSilentRevertHex(best.rawData)) break;
  }
  return best;
}
