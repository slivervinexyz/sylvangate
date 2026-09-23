import { describe, expect, it, vi } from "vitest";
import { encodeErrorResult, type Hex } from "viem";
import { GMX_SYNTHETICS_ERRORS_ABI } from "../../src/services/adapters/gmx-synthetics-errors";
import {
  diagnoseGmxFailedTransaction,
  extractTraceRevertHint,
  fetchGmxTxCallTrace,
  isAlchemyRpc,
  needsForcedCallTrace,
  replayGmxTxEthCall,
  resolveGmxDiagnosticRpcProviders,
  scrapeJsonRpcRevertData,
} from "../../src/services/adapters/gmx-micro-fill-rpc-diagnostics";

const TX = {
  from: "0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F" as Hex,
  to: "0x7dE39FF2e232A2203196788d37e234cF8F1b83f1" as Hex,
  input: "0xdeadbeef" as Hex,
  value: 0n,
  gas: 2_000_000n,
  blockTag: "0x1" as Hex,
};

describe("gmx-micro-fill-rpc-diagnostics", () => {
  it("isAlchemyRpc detects Alchemy hosts", () => {
    expect(isAlchemyRpc("https://arb-mainnet.g.alchemy.com/v2/demo")).toBe(true);
    expect(isAlchemyRpc("https://arb1.arbitrum.io/rpc")).toBe(false);
  });

  it("resolveGmxDiagnosticRpcProviders excludes Alchemy and honors GMX_DIAGNOSTIC_RPC_URL", () => {
    vi.stubEnv("GMX_DIAGNOSTIC_RPC_URL", "https://custom-rpc.example/rpc");
    const list = resolveGmxDiagnosticRpcProviders("https://arb-mainnet.g.alchemy.com/v2/key");
    expect(list[0]).toBe("https://custom-rpc.example/rpc");
    expect(list.some((u) => u.includes("alchemy"))).toBe(false);
    vi.unstubAllEnvs();
  });

  it("scrapeJsonRpcRevertData unwraps nested Alchemy-style error payloads", () => {
    const data = "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004746f6f00" as Hex;
    expect(scrapeJsonRpcRevertData({ error: { data } })).toBe(data);
    expect(scrapeJsonRpcRevertData({ error: { data: { data } } })).toBe(data);
  });

  it("extractTraceRevertHint walks nested callTracer output", () => {
    const raw = "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004746f6f00";
    const hint = extractTraceRevertHint({
      type: "CALL",
      to: "0x7dE39FF2e232A2203196788d37e234cF8F1b83f1",
      calls: [{ type: "DELEGATECALL", to: "0x0000000000000000000000000000000000000001", output: raw, error: "execution reverted" }],
    });
    expect(hint?.rawData).toBe(raw);
    expect(hint?.callPath).toContain("DELEGATECALL");
    expect(hint?.depth).toBeGreaterThan(0);
  });

  it("extractTraceRevertHint prefers deepest nested GMX custom error", () => {
    const inner = encodeErrorResult({
      abi: GMX_SYNTHETICS_ERRORS_ABI,
      errorName: "InsufficientExecutionFee",
      args: [5n, 1n],
    });
    const hint = extractTraceRevertHint({
      type: "CALL",
      calls: [
        { type: "CALL", error: "execution reverted" },
        {
          type: "DELEGATECALL",
          calls: [{ type: "CALL", output: inner, error: "execution reverted" }],
        },
      ],
    });
    expect(hint?.hint).toContain("InsufficientExecutionFee");
    expect(hint?.depth).toBe(2);
  });

  it("needsForcedCallTrace is true for silent or undecodable eth_call results", () => {
    expect(needsForcedCallTrace(undefined)).toBe(true);
    expect(needsForcedCallTrace({ summary: "silent revert (no custom error data)" })).toBe(true);
    expect(needsForcedCallTrace({ summary: "x", rawData: "0x" as Hex })).toBe(true);
    expect(needsForcedCallTrace({
      summary: "ok",
      rawData: "0xdeadbeef" as Hex,
      decodedError: "[GMX:InsufficientExecutionFee] InsufficientExecutionFee(2, 1)",
    })).toBe(false);
  });

  it("replayGmxTxEthCall decodes and labels InsufficientExecutionFee from fallback RPC", async () => {
    const revertData = encodeErrorResult({
      abi: GMX_SYNTHETICS_ERRORS_ABI,
      errorName: "InsufficientExecutionFee",
      args: [2n, 1n],
    });
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted", data: revertData } })),
    );
    const result = await replayGmxTxEthCall({
      rpcUrl: "https://arb1.arbitrum.io/rpc",
      tx: TX,
      fetchFn,
    });
    expect(result?.errorLabel).toBe("InsufficientExecutionFee");
    expect(result?.decodedError).toBe("[GMX:InsufficientExecutionFee] InsufficientExecutionFee(2, 1)");
    expect(result?.summary).toContain("[GMX:InsufficientExecutionFee]");
    expect(result?.rpcUrl).toBe("https://arb1.arbitrum.io/rpc");
  });

  it("diagnoseGmxFailedTransaction forces debug_trace when eth_call returns 0x", async () => {
    const traceRevert = encodeErrorResult({
      abi: GMX_SYNTHETICS_ERRORS_ABI,
      errorName: "MarketNotFound",
      args: ["0x70d95587d40A2caf56bd97485aB3Eec10Bee6336"],
    });
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "eth_call") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted", data: "0x" } }));
      }
      if (body.method === "debug_traceTransaction") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            type: "CALL",
            calls: [{ type: "DELEGATECALL", output: traceRevert, error: "execution reverted" }],
          },
        }));
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "not supported" } }));
    });
    const diag = await diagnoseGmxFailedTransaction({
      tx: TX,
      txHash: "0x3af365a1ae9246bc2d8c51d8ed6e502677bff786b569c11392d080debd7c1f72",
      fetchFn,
      primaryReplay: { summary: "silent revert (no custom error data)" },
    });
    expect(diag?.source).toBe("debug_trace");
    expect(diag?.decodedError).toContain("[GMX:MarketNotFound]");
    expect(diag?.callPath).toContain("DELEGATECALL");
    expect(fetchFn.mock.calls.some((c) => String(c[1]?.body ?? "").includes("debug_traceTransaction"))).toBe(true);
  });

  it("fetchGmxTxCallTrace falls back to trace_transaction when debug_trace is unavailable", async () => {
    const traceRevert = encodeErrorResult({ abi: GMX_SYNTHETICS_ERRORS_ABI, errorName: "EmptyOrder", args: [] });
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "debug_traceTransaction") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "method not found" } }));
      }
      if (body.method === "trace_transaction") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: [{ type: "call", error: "Reverted", output: traceRevert }],
        }));
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601 } }));
    });
    const traced = await fetchGmxTxCallTrace({
      rpcUrl: "https://arb1.arbitrum.io/rpc",
      txHash: "0x3af365a1ae9246bc2d8c51d8ed6e502677bff786b569c11392d080debd7c1f72",
      fetchFn,
    });
    expect(traced?.source).toBe("trace_transaction");
    expect(traced?.decodedError).toBe("EmptyOrder");
  });

  it("diagnoseGmxFailedTransaction prefers fallback RPC when primary replay is silent", async () => {
    const revertData = encodeErrorResult({ abi: GMX_SYNTHETICS_ERRORS_ABI, errorName: "EmptyOrder", args: [] });
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted", data: revertData } })),
    );
    const diag = await diagnoseGmxFailedTransaction({
      tx: TX,
      txHash: "0x3af365a1ae9246bc2d8c51d8ed6e502677bff786b569c11392d080debd7c1f72",
      primaryRpc: "https://arb-mainnet.g.alchemy.com/v2/demo",
      fetchFn,
      primaryReplay: { summary: "silent revert (no custom error data)" },
    });
    expect(diag?.decodedError).toBe("EmptyOrder");
    expect(diag?.rpcUrl).toBe("https://arb1.arbitrum.io/rpc");
  });
});
