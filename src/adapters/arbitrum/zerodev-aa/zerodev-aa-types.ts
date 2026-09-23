/** @module ZeroDev Kernel v3 — ERC-7579 Modular Account Hook typings (Ultra-Relay Intent Network SSOT) */

export interface ZeroDevAAConfigOptions {
  pmKey?: string;
  kernelVersion?: string;
  chainId?: number;
  projectId?: string;
  bundlerRpc?: string;
}

export interface ZeroDevAAEnvConfig extends ZeroDevAAConfigOptions {
  projectId: string;
  bundlerRpc: string;
}

/** ERC-7579 module type IDs — ZeroDev Kernel v3 Modular Account Hook standard. */
export const ERC7579_MODULE_TYPE_VALIDATOR = 1 as const;
export const ERC7579_MODULE_TYPE_HOOK = 4 as const;

/** `SliverVineRiskOracle` — ERC-7579 Pre-Execution Hook (TYPE 4) before Ultra-Relay ingress. */
export interface Erc7579PreExecutionHookBinding {
  hookType: typeof ERC7579_MODULE_TYPE_HOOK;
  riskOracleContract: `0x${string}`;
  kernelVersion: string;
  ultraRelayIntentNetwork: boolean;
}

/** Kernel v3 scoped session validator — ERC-7579 TYPE 1 (`ORDER_EXECUTE`). */
export interface Erc7579ValidatorModuleBinding {
  moduleType: typeof ERC7579_MODULE_TYPE_VALIDATOR;
  sessionPermission: "ORDER_EXECUTE";
  kernelVersion: string;
}

/** ERC-7579 install state returned by `buildKernelAccount` — honest SSOT (v1.0). */
export interface KernelErc7579Manifest {
  validatorType: typeof ERC7579_MODULE_TYPE_VALIDATOR;
  hookTypePlanned: typeof ERC7579_MODULE_TYPE_HOOK;
  hookInstalled: false;
  ultraRelay: true;
}

export interface UserOpDraftSummary {
  sender: string;
  callDataLength: number;
  entryPoint: string;
  kernelVersion: string;
  sponsored: boolean;
  paymasterAttached: boolean;
}

export interface ZeroDevMultichainProbeSummary {
  chainId: number;
  label: string;
  bundlerStatus: string;
  sponsored: boolean;
  paymasterAttached: boolean;
  bundlerReachable?: boolean;
  errors: string[];
}

export interface ZeroDevFailoverStatus {
  active: boolean;
  reason: string | null;
  primaryChainId: number;
  exomeshGmxBlocked: boolean;
  sequencerSafe: boolean;
  oracleHealthy: boolean;
  rpcLatencyMs: number | null;
  rpcLatencyExceeded: boolean;
  sequencerGraceActive: boolean;
}

export interface ZeroDevSmokeReport {
  featureFlag: boolean;
  bundlerStatus: string;
  isolationVerified: boolean;
  noPrivateKeyMaterialDetected: boolean;
  timestamp: string;
  chainId: number;
  gitCommitHash: string;
  enabled: boolean;
  configPresent: boolean;
  errors: string[];
  sponsored: boolean;
  paymasterAttached: boolean;
  bundlerReachable?: boolean;
  smartAccountAddress?: string;
  userOpDraft?: UserOpDraftSummary;
  entryPoint07Supported?: boolean;
  multichainProbes?: ZeroDevMultichainProbeSummary[];
  failover?: ZeroDevFailoverStatus;
}
