import { probeBundler } from "./zerodev-aa-bundler";
import { buildKernelUserOpDraft } from "../../../services/aa-adapter/zerodev-kernel-adapter";
import type { ZeroDevAAConfigOptions, ZeroDevMultichainProbeSummary } from "./zerodev-aa-types";
import { buildZeroDevRpcUrl } from "./zerodev-aa-constants";
import {
  ZERODEV_MULTICHAIN_LABELS,
  type ZeroDevMultichainProbeChainId,
} from "./zerodev-aa-chain";
import { readOwnerKey } from "./zerodev-aa-smoke-helpers";

export async function probeChain(
  chainId: ZeroDevMultichainProbeChainId,
  opts: ZeroDevAAConfigOptions,
  env: Record<string, string>,
  live: boolean,
): Promise<ZeroDevMultichainProbeSummary> {
  const label = ZERODEV_MULTICHAIN_LABELS[chainId];
  const projectId = opts.projectId ?? env.ZERODEV_PROJECT_ID;
  const bundlerRpc =
    opts.bundlerRpc ??
    (projectId ? buildZeroDevRpcUrl(projectId, chainId) : undefined);
  const errors: string[] = [];
  if (!projectId) errors.push("ZERODEV_PROJECT_ID missing");
  if (!bundlerRpc) errors.push("ZERODEV_BUNDLER_RPC missing");

  let bundlerReachable: boolean | undefined;
  let paymasterAttached = false;

  if (errors.length === 0 && bundlerRpc) {
    const draft = await buildKernelUserOpDraft({
      kernel: {
        chainId,
        ownerPrivateKey: readOwnerKey(env),
        kernelVersion: opts.kernelVersion,
      },
      userOp: { sponsored: true, bundlerRpc, chainId },
      env,
    });
    paymasterAttached = Boolean(draft.paymasterMiddleware);

    if (live) {
      const probe = await probeBundler(bundlerRpc);
      bundlerReachable = probe.reachable && probe.supportsEntryPoint07;
      if (!probe.reachable) errors.push(probe.error ?? "bundler unreachable");
      if (probe.reachable && !probe.supportsEntryPoint07) {
        errors.push("bundler missing EntryPoint v0.7");
      }
    }
  }

  const bundlerStatus = !live
    ? "DRY_RUN"
    : bundlerReachable
      ? "REACHABLE"
      : "UNREACHABLE";

  return {
    chainId,
    label,
    bundlerStatus,
    sponsored: true,
    paymasterAttached,
    bundlerReachable,
    errors,
  };
}
