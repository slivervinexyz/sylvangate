/**
 * SPDX-License-Identifier: Apache-2.0
 * Calldata selector fingerprints + parsed tx shapes (cold-path type barrel).
 */

/** ERC20 / router / Permit2 selectors as u32 big-endian fingerprints. */
export const SEL_ERC20_APPROVE = 0x095ea7b3;
export const SEL_ERC20_TRANSFER = 0xa9059cbb;
export const SEL_UNISWAP_V2_SWAP_EXACT = 0x38ed1739;
export const SEL_UNISWAP_V2_SWAP_ETH = 0x7ff36ab5;
export const SEL_UNISWAP_V3_EXACT_INPUT_SINGLE = 0x414bf389;
/** IPoolManager.swap(PoolKey,SwapParams,bytes) — Uniswap v4-core ABI. */
export const SEL_UNISWAP_V4_SWAP = 0xf3cd914c;
/** IPoolManager.modifyLiquidity(PoolKey,ModifyLiquidityParams,bytes). */
export const SEL_UNISWAP_V4_MODIFY_LIQUIDITY = 0x5a6bcfda;
/** IPoolManager.donate(PoolKey,uint256,uint256,bytes). */
export const SEL_UNISWAP_V4_DONATE = 0x234266d7;
/** IPoolManager.unlock(bytes) — outer callback wrapper. */
export const SEL_UNISWAP_V4_UNLOCK = 0x48c89491;
export const SEL_GMX_MULTICALL = 0xac9650d8;
/** Permit2 permit(address,PermitSingle,bytes) — EIP-7730-exposed router surface. */
export const SEL_PERMIT2_PERMIT = 0x2a0886f7;
/** Permit2 approve(address,address,uint160,uint48). */
export const SEL_PERMIT2_APPROVE = 0x87517c45;
/** ERC-7540 requestDeposit(uint256,address,address). */
export const SEL_ERC7540_REQUEST_DEPOSIT = 0xb2d9f201;
/** ERC-7540 requestRedeem(uint256,address,address). */
export const SEL_ERC7540_REQUEST_REDEEM = 0x710e20f1;
/** ERC-7540 setOperator(address,bool). */
export const SEL_ERC7540_SET_OPERATOR = 0x9cc233d6;

/** Hex string mirrors for tests / logging only — not used in hot-path compare. */
export const SELECTOR_ERC20_APPROVE = "0x095ea7b3";
export const SELECTOR_ERC20_TRANSFER = "0xa9059cbb";
export const SELECTOR_UNISWAP_V2_SWAP_EXACT = "0x38ed1739";
export const SELECTOR_UNISWAP_V3_EXACT_INPUT_SINGLE = "0x414bf389";
export const SELECTOR_UNISWAP_V4_SWAP = "0xf3cd914c";
export const SELECTOR_UNISWAP_V4_MODIFY_LIQUIDITY = "0x5a6bcfda";
export const SELECTOR_UNISWAP_V4_DONATE = "0x234266d7";
export const SELECTOR_UNISWAP_V4_UNLOCK = "0x48c89491";
export const SELECTOR_GMX_MULTICALL = "0xac9650d8";
export const SELECTOR_PERMIT2_PERMIT = "0x2a0886f7";
export const SELECTOR_PERMIT2_APPROVE = "0x87517c45";
export const SELECTOR_ERC7540_REQUEST_DEPOSIT = "0xb2d9f201";
export const SELECTOR_ERC7540_REQUEST_REDEEM = "0x710e20f1";
export const SELECTOR_ERC7540_SET_OPERATOR = "0x9cc233d6";

export const UINT256_MAX =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
export const UINT160_MAX = (1n << 160n) - 1n;

export interface ParsedApprove {
  kind: "approve";
  token: string;
  spender: string;
  amountWei: bigint;
  infinite: boolean;
}

export interface ParsedTransfer {
  kind: "transfer";
  token: string;
  to: string;
  amountWei: bigint;
}

export interface ParsedSwap {
  kind: "swap";
  router: string;
  selectorU32: number;
}

export interface ParsedPermit2Approve {
  kind: "permit2_approve";
  permit2: string;
  token: string;
  spender: string;
  amountWei: bigint;
  infinite: boolean;
}

export interface ParsedPermit2Permit {
  kind: "permit2_permit";
  permit2: string;
  owner: string;
  token: string;
  spender: string;
  amountWei: bigint;
  infinite: boolean;
}

export interface ParsedErc7540Request {
  kind: "erc7540_request_deposit" | "erc7540_request_redeem";
  vault: string;
  amountWei: bigint;
  controller: string;
  owner: string;
}

export interface ParsedErc7540SetOperator {
  kind: "erc7540_set_operator";
  vault: string;
  operator: string;
  approved: boolean;
}

export interface ParsedUnknown {
  kind: "unknown";
  to: string;
  selectorU32: number;
}

export type ParsedCalldata =
  | ParsedApprove
  | ParsedTransfer
  | ParsedSwap
  | ParsedPermit2Approve
  | ParsedPermit2Permit
  | ParsedErc7540Request
  | ParsedErc7540SetOperator
  | ParsedUnknown;

export function isUniswapV4Selector(sel: number): boolean {
  return (
    sel === SEL_UNISWAP_V4_SWAP ||
    sel === SEL_UNISWAP_V4_MODIFY_LIQUIDITY ||
    sel === SEL_UNISWAP_V4_DONATE ||
    sel === SEL_UNISWAP_V4_UNLOCK
  );
}

export interface TxCalldataInput {
  to?: string;
  data?: string;
}
