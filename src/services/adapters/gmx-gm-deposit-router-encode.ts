/** GMX v2 GM Pool deposit adapter — barrel re-export (<200 LOC per module). */
export {
  GMX_DEPOSIT_VAULT_ARBITRUM,
  GMX_GM_DEPOSIT_DUAL_MULTICALL_METHODS,
  GMX_GM_DEPOSIT_SINGLE_MULTICALL_METHODS,
  GMX_GM_ETH_USDC_LONG_TOKEN,
  GMX_GM_ETH_USDC_MARKET,
  GMX_GM_ETH_USDC_SHORT_TOKEN,
} from "./gmx-gm-deposit-constants";
export {
  buildGmxGmDepositFromLegacyInput,
  buildGmxGmDepositUnsignedPayload,
  buildGmxGmDualTokenDepositPayload,
  buildGmxGmUsdcOnlyDepositPayload,
} from "./gmx-gm-deposit-build";
export {
  assertGmxGmDepositDataListWire,
  buildGmxCreateDepositWireParams,
  encodeGmxCreateDepositCalldata,
  GMX_CREATE_DEPOSIT_ABI_FRAGMENT,
  gmxCreateDepositAbi,
  resolveGmxGmDepositMarketTokens,
  stripGmxGmDepositOnChainMetadata,
} from "./gmx-gm-deposit-encode";
export {
  assertGmxGmDepositMulticallLegs,
  buildGmxGmDepositMulticallCalls,
  buildGmxGmDepositRouterMulticall,
  buildGmxGmDepositTokenTransfers,
  decodeGmxGmDepositMulticallLegs,
  gmxDepositRouterAbi,
} from "./gmx-gm-deposit-multicall";
export { assertGmxGmDepositWire, auditGmxGmDepositWireParams } from "./gmx-gm-deposit-audit";
export type {
  GmxGmDepositBuildInput,
  GmxGmDepositTokenTransfer,
  GmxGmDepositUnsignedPayload,
  GmxGmDepositWireAddresses,
  GmxGmDepositWireParams,
} from "./gmx-gm-deposit-types";
