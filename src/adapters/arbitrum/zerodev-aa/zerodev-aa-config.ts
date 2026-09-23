import type { ZeroDevAAConfigOptions, ZeroDevAAEnvConfig } from "./zerodev-aa-types";
import { ARBITRUM_ONE_CHAIN_ID, resolveZeroDevBundlerRpc } from "./zerodev-aa-constants";
import { isZeroDevAAEnabled } from "./zerodev-aa-gateway-badge";

function readEnv(env?: Record<string, string>): Record<string, string> {
  if (env) return env;
  return typeof process !== "undefined" ? (process.env as Record<string, string>) : {};
}

export function resolveZeroDevConfig(env?: Record<string, string>): ZeroDevAAConfigOptions {
  const e = readEnv(env);
  const chainId = Number(e.ZERODEV_CHAIN_ID ?? ARBITRUM_ONE_CHAIN_ID);
  const base: ZeroDevAAConfigOptions = { chainId };
  if (!isZeroDevAAEnabled(e)) return base;

  const projectId = e.ZERODEV_PROJECT_ID;
  return {
    ...base,
    pmKey: e.ZERODEV_PM_KEY,
    kernelVersion: e.ZERODEV_KERNEL_VERSION ?? "0.3.1",
    projectId,
    bundlerRpc: resolveZeroDevBundlerRpc(e, chainId),
  };
}

export function resolveZeroDevEnvConfig(env?: Record<string, string>): ZeroDevAAEnvConfig | null {
  const cfg = resolveZeroDevConfig(env);
  if (!cfg.projectId || !cfg.bundlerRpc) return null;
  return { ...cfg, projectId: cfg.projectId, bundlerRpc: cfg.bundlerRpc };
}
