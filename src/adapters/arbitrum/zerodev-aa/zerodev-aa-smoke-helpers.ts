import { type Hex, isHex } from "viem";
import { resolveZeroDevConfig } from "./zerodev-aa-config";
import { resolveAaProbeRouteAsync } from "./zerodev-aa-gate";
import { ZERODEV_SPONSORED_DEFAULT } from "./zerodev-aa-userop";
import type { ZeroDevFailoverStatus, ZeroDevSmokeReport } from "./zerodev-aa-types";
import { ARBITRUM_ONE_CHAIN_ID } from "./zerodev-aa-constants";

export function readEnv(): Record<string, string> {
  return typeof process !== "undefined" ? (process.env as Record<string, string>) : {};
}

export function auditMeta(
  chainId: number,
): Pick<ZeroDevSmokeReport, "timestamp" | "chainId" | "gitCommitHash"> {
  return {
    timestamp: new Date().toISOString(),
    chainId,
    gitCommitHash: readEnv().GIT_COMMIT_HASH ?? "unknown",
  };
}

export function disabledReport(): ZeroDevSmokeReport {
  return {
    ...auditMeta(ARBITRUM_ONE_CHAIN_ID),
    featureFlag: false,
    bundlerStatus: "DISABLED",
    isolationVerified: true,
    noPrivateKeyMaterialDetected: true,
    enabled: false,
    configPresent: false,
    errors: [],
    sponsored: ZERODEV_SPONSORED_DEFAULT,
    paymasterAttached: false,
  };
}

export function readOwnerKey(env: Record<string, string>): Hex | undefined {
  const raw = env.ZERODEV_OWNER_PRIVATE_KEY;
  return raw && isHex(raw) ? raw : undefined;
}

export function buildFailoverStatus(
  route: Awaited<ReturnType<typeof resolveAaProbeRouteAsync>>,
): ZeroDevFailoverStatus {
  return {
    active: route.failoverActive,
    reason: route.failoverReason,
    primaryChainId: route.primaryChainId,
    exomeshGmxBlocked: route.exomeshGmxBlocked,
    sequencerSafe: route.health.sequencerSafe,
    oracleHealthy: route.health.oracleHealthy,
    rpcLatencyMs: route.health.rpcLatencyMs,
    rpcLatencyExceeded: route.health.rpcLatencyExceeded,
    sequencerGraceActive: route.health.sequencerGraceActive,
  };
}

export function resolveSmokeProbeOpts(
  configOrLive: import("./zerodev-aa-types").ZeroDevAAConfigOptions | boolean | undefined,
  env: Record<string, string>,
) {
  return typeof configOrLive === "object" ? configOrLive : resolveZeroDevConfig(env);
}
