import {
  readLayoutMetricEnv,
  readSessionEntropySeed,
  SESSION_ENTROPY_SEED_CANONICAL,
  validateLayoutMetricUnlock,
  type LayoutMetricConfig,
} from "../layout-metric-provider";
import {
  hostFromUrl,
  isHoneyPotHost,
  resolveEffectiveRpcHosts,
} from "../rpc-allowlist-hosts";

export const EXOMESH_SESSION_SIG_HEADER = "X-ExoMesh-Session-Sig" as const;
export const HONEYPOT_STATUS_CODE = 0x99 as const;
export const HONEYPOT_ACTIVE = "HONEYPOT_ACTIVE" as const;
export const HONEYPOT_SIMULATED_SLIPPAGE = 0.99 as const;
export const BROWSER_MIMIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" as const;
export const RPC_FETCH_TIMEOUT_MS = 300 as const;

export interface RpcFetchGateOptions {
  circuitProbe?: boolean;
}

export interface RpcDefenseGateResult {
  authenticated: boolean;
  fastPath: boolean;
  tripped: boolean;
  statusCode?: number;
  code?: string;
}

export class RpcNodeNotAllowlistedError extends Error {
  readonly code = "RPC_NODE_NOT_ALLOWLISTED" as const;

  constructor(public readonly url: string) {
    super(`RPC node not on allowlist: ${url}`);
    this.name = "RpcNodeNotAllowlistedError";
  }
}

export class HoneyPotCircuitBreakError extends Error {
  readonly code = "HONEYPOT_CIRCUIT_BREAK" as const;
  readonly httpStatus = 500 as const;
  readonly statusCode = HONEYPOT_STATUS_CODE;
  readonly honeypotActive = HONEYPOT_ACTIVE;
  readonly simulatedSlippage = HONEYPOT_SIMULATED_SLIPPAGE;

  constructor(public readonly url: string) {
    super(
      `${HONEYPOT_ACTIVE} (statusCode=0x${HONEYPOT_STATUS_CODE.toString(16)}) — synthetic slippage lock: ${url}`,
    );
    this.name = "HoneyPotCircuitBreakError";
  }
}

export function isRpcDefenseAuthenticated(
  env?: LayoutMetricConfig,
  init?: RequestInit,
): boolean {
  const cfg = readLayoutMetricEnv(env);
  if (validateLayoutMetricUnlock(cfg)) return true;
  const entropySeed = readSessionEntropySeed(cfg);
  if (entropySeed === SESSION_ENTROPY_SEED_CANONICAL) return true;
  if (init?.headers) {
    const sig = new Headers(init.headers).get(EXOMESH_SESSION_SIG_HEADER)?.trim();
    if (sig === SESSION_ENTROPY_SEED_CANONICAL) return true;
  }
  return false;
}

export function evaluateRpcDefenseGate(
  url: string,
  env?: LayoutMetricConfig,
  init?: RequestInit,
  gate?: RpcFetchGateOptions,
): RpcDefenseGateResult {
  const authenticated = isRpcDefenseAuthenticated(env, init);
  const host = hostFromUrl(url);
  const shouldTrap =
    !authenticated &&
    ((host !== null && isHoneyPotHost(host)) || gate?.circuitProbe === true);
  if (shouldTrap) {
    return {
      authenticated: false,
      fastPath: false,
      tripped: true,
      statusCode: HONEYPOT_STATUS_CODE,
      code: HONEYPOT_ACTIVE,
    };
  }
  return { authenticated, fastPath: authenticated, tripped: false };
}

export function buildHoneyPotDecoyTelemetry(url: string) {
  return Object.freeze({
    statusCode: HONEYPOT_STATUS_CODE,
    code: HONEYPOT_ACTIVE,
    simulatedSlippage: HONEYPOT_SIMULATED_SLIPPAGE,
    telemetry: Object.freeze({
      blocked: true as const,
      failClosed: true as const,
      reasons: Object.freeze([HONEYPOT_ACTIVE]),
    }),
    url,
  });
}

export function tripHoneyPotCircuit(url: string): never {
  throw new HoneyPotCircuitBreakError(url);
}

export function enforceRpcDefenseGate(
  url: string,
  env?: LayoutMetricConfig,
  init?: RequestInit,
  gate?: RpcFetchGateOptions,
): void {
  if (evaluateRpcDefenseGate(url, env, init, gate).tripped) tripHoneyPotCircuit(url);
}

export function assertRpcAllowlisted(
  url: string,
  extraHosts: readonly string[] = [],
  env?: LayoutMetricConfig,
  gate?: RpcFetchGateOptions,
  init?: RequestInit,
): void {
  enforceRpcDefenseGate(url, env, init, gate);

  const host = hostFromUrl(url);
  if (!host) {
    throw new RpcNodeNotAllowlistedError(url);
  }

  const allowed = new Set(
    resolveEffectiveRpcHosts(env, extraHosts).map((h) => h.toLowerCase()),
  );

  if (!allowed.has(host)) {
    throw new RpcNodeNotAllowlistedError(url);
  }
}

export function isLayoutMetricPresent(env?: LayoutMetricConfig): boolean {
  return validateLayoutMetricUnlock(env);
}
