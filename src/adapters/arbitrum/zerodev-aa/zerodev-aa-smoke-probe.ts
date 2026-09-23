import { probeBundler } from "./zerodev-aa-bundler";
import {
  canProceedAaProbeRoute,
  isZeroDevAAEnabled,
  resolveAaProbeRouteAsync,
} from "./zerodev-aa-gate";
import { buildKernelUserOpDraft } from "../../../services/aa-adapter/zerodev-kernel-adapter";
import type { ZeroDevAAConfigOptions, ZeroDevSmokeReport } from "./zerodev-aa-types";
import { ARBITRUM_ONE_CHAIN_ID, buildZeroDevRpcUrl } from "./zerodev-aa-constants";
import { ZERODEV_MULTICHAIN_PROBE_CHAIN_IDS } from "./zerodev-aa-chain";
import { ZERODEV_SPONSORED_DEFAULT } from "./zerodev-aa-userop";
import {
  auditMeta,
  buildFailoverStatus,
  disabledReport,
  readEnv,
  readOwnerKey,
  resolveSmokeProbeOpts,
} from "./zerodev-aa-smoke-helpers";
import { probeChain } from "./zerodev-aa-smoke-probe-chain";

export async function runZeroDevSmokeProbe(
  configOrLive?: ZeroDevAAConfigOptions | boolean,
): Promise<ZeroDevSmokeReport> {
  const env = readEnv();
  if (!isZeroDevAAEnabled(env)) return disabledReport();

  const live = configOrLive === true;
  const probeRoute = await resolveAaProbeRouteAsync(env);
  const failover = buildFailoverStatus(probeRoute);

  if (!canProceedAaProbeRoute(probeRoute) && probeRoute.exomeshGmxBlocked) {
    return {
      ...auditMeta(probeRoute.primaryChainId),
      featureFlag: true,
      bundlerStatus: "FAIL_CLOSED",
      isolationVerified: false,
      noPrivateKeyMaterialDetected: true,
      enabled: true,
      configPresent: false,
      errors: [probeRoute.failoverReason ?? "EXOMESH_GMX_FAIL_CLOSED"],
      sponsored: ZERODEV_SPONSORED_DEFAULT,
      paymasterAttached: false,
      failover,
    };
  }

  const opts = resolveSmokeProbeOpts(configOrLive, env);
  const chainId = probeRoute.failoverActive ? probeRoute.primaryChainId : (opts.chainId ?? ARBITRUM_ONE_CHAIN_ID);
  const projectId = opts.projectId ?? env.ZERODEV_PROJECT_ID;
  const bundlerRpc =
    opts.bundlerRpc ??
    (projectId ? buildZeroDevRpcUrl(projectId, chainId) : undefined);
  const errors: string[] = [];

  if (!projectId) errors.push("ZERODEV_PROJECT_ID missing");
  if (!bundlerRpc) errors.push("ZERODEV_BUNDLER_RPC missing");

  let bundlerReachable: boolean | undefined;
  let entryPoint07Supported: boolean | undefined;
  let smartAccountAddress: string | undefined;
  let userOpDraft: ZeroDevSmokeReport["userOpDraft"];
  let paymasterAttached = false;

  if (errors.length === 0) {
    const draft = await buildKernelUserOpDraft({
      kernel: {
        chainId,
        ownerPrivateKey: readOwnerKey(env),
        kernelVersion: opts.kernelVersion,
      },
      userOp: { sponsored: true, bundlerRpc: bundlerRpc!, chainId },
      env,
    });
    smartAccountAddress = draft.userOperation.sender;
    paymasterAttached = Boolean(draft.paymasterMiddleware);
    userOpDraft = {
      sender: draft.userOperation.sender,
      callDataLength: draft.userOperation.callData.length,
      entryPoint: draft.entryPoint,
      kernelVersion: draft.kernelVersion,
      sponsored: draft.sponsored,
      paymasterAttached,
    };

    if (live && bundlerRpc) {
      const probe = await probeBundler(bundlerRpc);
      bundlerReachable = probe.reachable && probe.supportsEntryPoint07;
      entryPoint07Supported = probe.supportsEntryPoint07;
      if (!probe.reachable) errors.push(probe.error ?? "bundler unreachable");
      if (probe.reachable && !probe.supportsEntryPoint07) {
        errors.push("bundler missing EntryPoint v0.7");
      }
    }
  }

  const multichainProbes = await Promise.all(
    ZERODEV_MULTICHAIN_PROBE_CHAIN_IDS.map((id) => probeChain(id, opts, env, live)),
  );

  const bundlerStatus = !live
    ? "DRY_RUN"
    : bundlerReachable
      ? "REACHABLE"
      : errors.length > 0
        ? "UNREACHABLE"
        : "UNREACHABLE";

  return {
    ...auditMeta(chainId),
    featureFlag: true,
    bundlerStatus,
    isolationVerified: errors.length === 0 && (!live || bundlerReachable === true),
    noPrivateKeyMaterialDetected: true,
    enabled: true,
    configPresent: errors.length === 0 || Boolean(projectId),
    errors,
    sponsored: true,
    paymasterAttached,
    bundlerReachable,
    smartAccountAddress,
    userOpDraft,
    entryPoint07Supported,
    multichainProbes,
    failover,
  };
}
