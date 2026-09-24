/** @module SliverVine SylvanGate (v1.0 SSRC) — ZeroDev Kernel v3 ERC-7579 Hook typings */
import type { SoilResistanceInput, SoilResistanceResult } from "../../../core/soil-resistance-types";
import type { ZERODEV_KERNEL_V4_CONDITION_INTERFACE_READY } from "./zerodev-aa-constants";

export type {
  Action,
  KERNEL_V3_VERSION_TYPE,
  KERNEL_VERSION_TYPE,
  KernelPluginManager,
  KernelValidatorHook,
} from "@zerodev/sdk";

/** Upstream-aligned condition verdict — maps SoilResistanceResult.tripped → satisfied. */
export interface ZeroDevV4ConditionVerdict {
  satisfied: boolean;
  soil: SoilResistanceResult;
}

/** Extendable Condition evaluator — upstream beta-SDK naming; bind checkSoilResistance. */
export type ZeroDevV4ConditionEvaluator = (input: SoilResistanceInput) => SoilResistanceResult;

/** Off-chain pre-condition gate — bind `evaluate: checkSoilResistance` from risk-engine-soil.ts. */
export interface ZeroDevV4ConditionProbe {
  readonly interfaceReady: typeof ZERODEV_KERNEL_V4_CONDITION_INTERFACE_READY;
  evaluate: ZeroDevV4ConditionEvaluator;
}

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

/** ERC-7579 standard module type IDs (distinct from upstream VALIDATOR_TYPE hex flags). */
export const ERC7579_MODULE_TYPE_VALIDATOR = 1 as const;
export const ERC7579_MODULE_TYPE_HOOK = 4 as const;

/** SliverVineRiskOracle — aligns with upstream KernelValidatorHook pre-execution gate (TYPE 4). */
export interface Erc7579PreExecutionHookBinding {
  hookType: typeof ERC7579_MODULE_TYPE_HOOK;
  riskOracleContract: `0x${string}`;
  kernelVersion: string;
  ultraRelayIntentNetwork: boolean;
}

/** Kernel v3 Permission path — ERC-7579 TYPE 1; see upstream VALIDATOR_TYPE.PERMISSION. */
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
