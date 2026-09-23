/**
 * SPDX-License-Identifier: Apache-2.0
 * EIP-1193 Agentic Wallet Guard — provider middleware (Apache wrapper · Wasm IP core).
 */
import { EIP5792_WALLET_SEND_CALLS, evaluateEip5792WalletSendCalls } from "./eip5792-send-calls";
import { evaluateRetailRisk } from "./risk-evaluator";
import type { EIP1193Provider, RetailGuardConfig, RetailGuardRejectPayload } from "./types";

export const EXOMESH_AGENTIC_GUARD_NAME = "SliverVine ExoMesh Agentic Guard (EIP-1193+)";

export class RetailGuardRejectedError extends Error {
  readonly code: RetailGuardRejectPayload["code"];
  readonly plainTextWarning: string;

  constructor(payload: RetailGuardRejectPayload) {
    super(`[${EXOMESH_AGENTIC_GUARD_NAME}] ${payload.code}: ${payload.message}`);
    this.name = "RetailGuardRejectedError";
    this.code = payload.code;
    this.plainTextWarning = payload.plainTextWarning;
  }
}

/** EIP-6963 provider metadata (multi-injected wallet discovery). */
export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

export interface AnnounceGuardedProviderOptions {
  uuid?: string;
  name?: string;
  icon?: string;
  rdns?: string;
  /** When true (default), register EIP-6963 announce + request listeners. */
  announce?: boolean;
  /** Event target (default `globalThis`); pass a mock in Vitest. */
  target?: EIP6963EventTarget;
}

export interface EIP6963EventTarget {
  dispatchEvent?(event: { type: string; detail?: EIP6963ProviderDetail }): boolean;
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

const GUARDED_METHODS = new Set([
  "eth_sendTransaction",
  "eth_signTypedData_v4",
  EIP5792_WALLET_SEND_CALLS,
]);
const DEFAULT_RDNS = "io.slivervine.agenticretailwalletguard";

function resolveAnnounceTarget(
  target?: EIP6963EventTarget,
): EIP6963EventTarget | undefined {
  if (target) return target;
  const g = globalThis as EIP6963EventTarget & { window?: EIP6963EventTarget };
  return g.window ?? g;
}

function createProviderUuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `retail-guard-${Date.now().toString(36)}`;
}

/** Wrap an EIP-1193 provider with EIP-1193 Agentic Wallet Guard (0-Gas fail-closed pre-broadcast). */
export function withRetailGuardProvider(
  baseProvider: EIP1193Provider,
  config: RetailGuardConfig,
): EIP1193Provider {
  return {
    request: async (args) => {
      const method = args.method;
      const params = args.params ?? [];

      if (GUARDED_METHODS.has(method)) {
        const reject =
          method === EIP5792_WALLET_SEND_CALLS
            ? evaluateEip5792WalletSendCalls(config, params)
            : evaluateRetailRisk(config, method, params);
        if (reject) throw new RetailGuardRejectedError(reject);
      }

      return baseProvider.request(args);
    },
  };
}

/**
 * Wrap `baseProvider` with retail guard and announce via EIP-6963.
 * Falls back to guarded-only wrap when `window.ethereum`, custom injectors, or
 * `CustomEvent` are unavailable (SSR / Node / legacy injectors).
 */
export function announceGuardedProvider(
  baseProvider: EIP1193Provider,
  config: RetailGuardConfig,
  options: AnnounceGuardedProviderOptions = {},
): EIP1193Provider {
  const guarded = withRetailGuardProvider(baseProvider, config);
  if (options.announce === false) return guarded;

  const target = resolveAnnounceTarget(options.target);
  if (!target?.dispatchEvent || !target?.addEventListener) return guarded;

  const info: EIP6963ProviderInfo = {
    uuid: options.uuid ?? createProviderUuid(),
    name: options.name ?? EXOMESH_AGENTIC_GUARD_NAME,
    icon: options.icon ?? "",
    rdns: options.rdns ?? DEFAULT_RDNS,
  };
  const detail: EIP6963ProviderDetail = { info, provider: guarded };

  const announce = (): void => {
    target.dispatchEvent!({ type: "eip6963:announceProvider", detail });
  };

  const onRequest = (): void => announce();
  target.addEventListener("eip6963:requestProvider", onRequest);
  announce();

  return guarded;
}

/** Resolve `window.ethereum` (or first `providers[]` entry) when present. */
export function resolveInjectedEthereum(): EIP1193Provider | null {
  const g = globalThis as {
    ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] };
  };
  const eth = g.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) return eth.providers[0]!;
  return eth;
}

export { __resetRetailGuardStateForTests, isRetailGuardChannelSevered } from "./guard-engine";
