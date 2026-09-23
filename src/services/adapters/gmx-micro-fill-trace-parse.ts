/** GMX micro-fill — callTracer / debug_traceTransaction nested revert parsing. */
import { type Hex } from "viem";
import { decodeGmxRevertData } from "./gmx-micro-fill-revert-decode";

export type TraceNode = {
  type?: string;
  from?: string;
  to?: string;
  error?: string;
  revertReason?: string;
  output?: string;
  calls?: TraceNode[];
};

export type GmxTraceRevertHint = {
  rawData?: Hex;
  hint?: string;
  callPath?: string;
  depth: number;
};

export function isSilentRevertHex(hex?: string): boolean {
  return !hex || hex === "0x" || hex.length < 10;
}

export function scrapeHexFromErrorMessage(error?: string): Hex | undefined {
  if (!error) return undefined;
  const match = error.match(/0x[0-9a-fA-F]{8,}/);
  return match ? (match[0] as Hex) : undefined;
}

function readRevertOutput(output?: string): Hex | undefined {
  if (typeof output !== "string" || !output.startsWith("0x") || isSilentRevertHex(output)) return undefined;
  return output as Hex;
}

function scoreTraceHint(hint: GmxTraceRevertHint): number {
  let score = hint.depth;
  if (hint.rawData && !isSilentRevertHex(hint.rawData)) score += 100;
  if (hint.hint && hint.hint !== "execution reverted") score += 20;
  if (hint.callPath) score += hint.depth;
  return score;
}

function buildTraceHint(node: TraceNode, path: string[], depth: number): GmxTraceRevertHint | undefined {
  const type = node.type ?? "CALL";
  const segment = node.to ? `${type}@${node.to.slice(0, 10)}` : type;
  const callPath = [...path, segment].join(">");
  const output = readRevertOutput(node.output);
  const errorHex = scrapeHexFromErrorMessage(node.error);
  const rawData = output ?? errorHex;
  const decoded = rawData ? decodeGmxRevertData(rawData) : null;
  if (decoded) {
    return { rawData, hint: decoded, callPath, depth };
  }
  if (rawData) {
    return { rawData, hint: `${type} revert output=${rawData.slice(0, 18)}…`, callPath, depth };
  }
  if (node.revertReason) {
    return { rawData: scrapeHexFromErrorMessage(node.revertReason), hint: node.revertReason, callPath, depth };
  }
  if (node.error && node.error !== "execution reverted") {
    return { rawData: errorHex, hint: node.error, callPath, depth };
  }
  if (node.error) {
    return { rawData: errorHex, hint: `${type}: ${node.error}`, callPath, depth };
  }
  return undefined;
}

/** Depth-first: prefer deepest nested frame with decodable custom error output. */
export function extractTraceRevertHint(trace: unknown): GmxTraceRevertHint | undefined {
  if (Array.isArray(trace)) return extractParityTraceRevertHint(trace);
  if (!trace || typeof trace !== "object") return undefined;
  let best: GmxTraceRevertHint | undefined;
  const walk = (node: TraceNode, path: string[], depth: number): void => {
    for (const child of node.calls ?? []) {
      walk(child, [...path, node.type ?? "CALL"], depth + 1);
    }
    const hint = buildTraceHint(node, path, depth);
    if (!hint) return;
    if (!best || scoreTraceHint(hint) > scoreTraceHint(best)) best = hint;
  };
  walk(trace as TraceNode, [], 0);
  return best;
}

function extractParityTraceRevertHint(frames: unknown[]): GmxTraceRevertHint | undefined {
  let best: GmxTraceRevertHint | undefined;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i] as TraceNode & { result?: { output?: string }; action?: { to?: string } };
    const node: TraceNode = {
      type: f.type ?? "call",
      to: f.to ?? f.action?.to,
      output: f.output ?? f.result?.output,
      error: f.error,
      revertReason: f.revertReason,
      calls: f.calls,
    };
    const hint = buildTraceHint(node, ["trace"], i);
    if (hint && (!best || scoreTraceHint(hint) > scoreTraceHint(best))) best = hint;
    if (f.calls?.length) {
      const nested = extractTraceRevertHint(f);
      if (nested && (!best || scoreTraceHint(nested) > scoreTraceHint(best))) best = nested;
    }
  }
  return best;
}
