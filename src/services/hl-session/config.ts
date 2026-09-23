import type { SystemState } from "../systemState";

export interface HyperliquidAdapterSecrets {
  privateKey?: string;
  sessionKey?: string;
}

export interface HyperliquidAdapterConfig extends HyperliquidAdapterSecrets {
  /** Force dry-run even when secrets exist */
  dryRun?: boolean;
}

export function resolveHyperliquidDryRun(
  config: HyperliquidAdapterConfig = {},
  systemState?: SystemState,
): boolean {
  if (systemState?.isSandboxMode === true) return true;
  if (config.dryRun === true) return true;
  if (config.dryRun === false) return false;
  const hasSecret = Boolean(config.privateKey?.trim() || config.sessionKey?.trim());
  return !hasSecret;
}
