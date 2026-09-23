import { RiskLimitExceeded } from "../../../services/risk-control";
import {
  BUNDLER_TIMEOUT_FAIL_CLOSED,
  ZERODEV_BUNDLER_FAIL_CLOSED_TIMEOUT_MS,
  ZERODEV_ENTRY_POINT_ADDRESS,
} from "./zerodev-aa-constants";

export interface BundlerProbeResult {
  reachable: boolean;
  entryPoints: string[];
  chainId: number | null;
  supportsEntryPoint07: boolean;
  error: string | null;
}

function throwBundlerTimeoutFailClosed(phase: string): never {
  throw new RiskLimitExceeded(
    `${BUNDLER_TIMEOUT_FAIL_CLOSED}:${phase}`,
    {
      level: "warn",
      module: "risk-control",
      event: "ROOT_PROTECTION_TRIP",
      symbol: "AA",
      timestamp: new Date().toISOString(),
      message: BUNDLER_TIMEOUT_FAIL_CLOSED,
      details: {
        phase,
        gate: "zerodev-aa",
        timeoutMs: ZERODEV_BUNDLER_FAIL_CLOSED_TIMEOUT_MS,
      },
    },
  );
}

function isAbortLikeError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  return err instanceof Error && err.name === "AbortError";
}

/** Bounded async guard — aborts waiters without cancelling upstream I/O. */
export async function withBundlerFailClosedTimeout<T>(
  promise: Promise<T>,
  phase: string,
  timeoutMs = ZERODEV_BUNDLER_FAIL_CLOSED_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(Object.assign(new Error(BUNDLER_TIMEOUT_FAIL_CLOSED), { name: "AbortError" })),
          { once: true },
        );
      }),
    ]);
  } catch (err) {
    if (controller.signal.aborted || isAbortLikeError(err)) {
      throwBundlerTimeoutFailClosed(phase);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function bundlerRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  timeoutMs = ZERODEV_BUNDLER_FAIL_CLOSED_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`bundler HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message ?? "bundler RPC error");
    return body.result as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function probeBundler(rpcUrl: string): Promise<BundlerProbeResult> {
  try {
    const entryPoints = await bundlerRpc<string[]>(rpcUrl, "eth_supportedEntryPoints");
    const chainHex = await bundlerRpc<string>(rpcUrl, "eth_chainId");
    const ep07 = ZERODEV_ENTRY_POINT_ADDRESS.toLowerCase();
    return {
      reachable: true,
      entryPoints,
      chainId: Number.parseInt(chainHex, 16),
      supportsEntryPoint07: entryPoints.some((ep) => ep.toLowerCase() === ep07),
      error: null,
    };
  } catch (err) {
    return {
      reachable: false,
      entryPoints: [],
      chainId: null,
      supportsEntryPoint07: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
