/**
 * SPDX-License-Identifier: Apache-2.0
 * @module @slivervine/exomesh-agentic-wallet-guard
 */
export {
  withRetailGuardProvider,
  announceGuardedProvider,
  resolveInjectedEthereum,
  RetailGuardRejectedError,
  EXOMESH_AGENTIC_GUARD_NAME,
} from "./provider";
export type {
  EIP6963ProviderInfo,
  EIP6963ProviderDetail,
  AnnounceGuardedProviderOptions,
  EIP6963EventTarget,
} from "./provider";
export { evaluateRetailRisk, parseTypedDataPayload } from "./risk-evaluator";
export type { RetailRiskEvalOptions } from "./risk-evaluator";
export {
  EIP5792_WALLET_SEND_CALLS,
  parseWalletSendCalls,
  evaluateEip5792WalletSendCalls,
} from "./eip5792-send-calls";
export {
  __resetRetailGuardStateForTests,
  isRetailGuardChannelSevered,
  evaluateRetailSoilGate,
  evaluateRetailIntentGate,
  evaluateRetailApproveGate,
  evaluateRetailVenueAllowlist,
  evaluateRpcTransportProtocol,
  resolveVenueBitFromContract,
  RETAIL_UNKNOWN_VENUE_BIT,
} from "./guard-engine";
export {
  evaluateTransportStreamSync,
  verifyTransportBitmark,
  bindTransportStreamScratch,
  isRpcTransportSyncFailed,
  __resetTransportStreamForTests,
  RPC_TRANSPORT_SYNC_FAIL_THRESHOLD,
  TS_RING_BASE,
} from "./transport-stream";
export type { TransportStreamSyncSnapshot } from "./transport-stream";
export {
  ensureRetailGuardWasm,
  isRetailGuardWasmReady,
  evaluateSoilViaWasm,
  evaluateIntentGateViaWasm,
  __resetRetailGuardWasmForTests,
} from "./wasm-adapter";
export {
  evaluateErc7540AsyncEscortGuard,
  evaluateErc7540FromParsedCalldata,
  computeErc7540SlippageDriftBps,
  ERC7540_CODES,
  type Erc7540AsyncQuote,
  type Erc7540RejectCode,
  type ParsedErc7540,
} from "./erc7540-async-escort";
export { parseTransactionCalldata, parseSelector, isInfiniteApproval } from "./calldata-parser";
export { readSelectorU32 } from "./calldata-hex";
export {
  encodeApproveCalldata,
  encodeErc7540RequestDepositCalldata,
  encodeErc7540SetOperatorCalldata,
  encodePermit2ApproveCalldata,
  encodePermit2PermitCalldata,
} from "./calldata-encoder";
export {
  UINT256_MAX,
  UINT160_MAX,
  SEL_ERC20_APPROVE,
  SEL_ERC20_TRANSFER,
  SEL_PERMIT2_PERMIT,
  SEL_PERMIT2_APPROVE,
  SEL_ERC7540_REQUEST_DEPOSIT,
  SEL_ERC7540_REQUEST_REDEEM,
  SEL_ERC7540_SET_OPERATOR,
  isUniswapV4Selector,
  SELECTOR_ERC20_APPROVE,
  SELECTOR_ERC20_TRANSFER,
  SELECTOR_UNISWAP_V2_SWAP_EXACT,
  SELECTOR_UNISWAP_V3_EXACT_INPUT_SINGLE,
  SELECTOR_UNISWAP_V4_SWAP,
  SELECTOR_UNISWAP_V4_MODIFY_LIQUIDITY,
  SELECTOR_UNISWAP_V4_DONATE,
  SELECTOR_UNISWAP_V4_UNLOCK,
  SELECTOR_GMX_MULTICALL,
  SELECTOR_PERMIT2_PERMIT,
  SELECTOR_PERMIT2_APPROVE,
  SELECTOR_ERC7540_REQUEST_DEPOSIT,
  SELECTOR_ERC7540_REQUEST_REDEEM,
  SELECTOR_ERC7540_SET_OPERATOR,
  type ParsedErc7540Request,
  type ParsedErc7540SetOperator,
} from "./calldata-types";
export {
  evaluateErc7683CrossChainIntentGuard,
  computeCrossChainExecutionDeltaBps,
  computeSolverMevBps,
  ERC7683_CODES,
  type CrossChainOrder,
  type Erc7683GuardVerdict,
  type Erc7683RejectCode,
} from "./erc7683-intent-guard";
export {
  decodeEip7702Authorization,
  evaluateEip7702AuthGuard,
  EIP7702_CODES,
  type Eip7702Authorization,
  type Eip7702AuthGuardConfig,
  type Eip7702AuthVerdict,
  type Eip7702RejectCode,
} from "./eip7702-auth-guard";
export { formatRetailWarning } from "./warnings";
export type {
  EIP1193Provider,
  RetailGuardConfig,
  RetailGuardReasonCode,
  RetailGuardRejectPayload,
  RetailGuardRiskInput,
  RetailSoilQuote,
} from "./types";
export type {
  ParsedCalldata,
  ParsedApprove,
  ParsedSwap,
  ParsedTransfer,
  ParsedPermit2Approve,
  ParsedPermit2Permit,
} from "./calldata-types";
export {
  evaluateUniswapV4HookGate,
  evaluateIntentGateWithV4Hook,
  decodeUniswapV4Calldata,
  V4_CODES,
} from "../../adapters/uniswap-v4-hook-guard";
