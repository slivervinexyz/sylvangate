/**
 * SPDX-License-Identifier: Apache-2.0
 * u32 selector sparse LUT dispatch — O(1) handler index lookup.
 */
import {
  CALLDATA_SCRATCH,
  readAddressAt,
  readUint160At,
  readUint256At,
  readWordU32,
} from "./calldata-hex";
import {
  SEL_ERC20_APPROVE,
  SEL_ERC20_TRANSFER,
  SEL_ERC7540_REQUEST_DEPOSIT,
  SEL_ERC7540_REQUEST_REDEEM,
  SEL_ERC7540_SET_OPERATOR,
  SEL_GMX_MULTICALL,
  SEL_PERMIT2_APPROVE,
  SEL_PERMIT2_PERMIT,
  SEL_UNISWAP_V2_SWAP_ETH,
  SEL_UNISWAP_V2_SWAP_EXACT,
  SEL_UNISWAP_V3_EXACT_INPUT_SINGLE,
  SEL_UNISWAP_V4_DONATE,
  SEL_UNISWAP_V4_MODIFY_LIQUIDITY,
  SEL_UNISWAP_V4_SWAP,
  SEL_UNISWAP_V4_UNLOCK,
  UINT160_MAX,
  UINT256_MAX,
  type ParsedCalldata,
} from "./calldata-types";

/** Handler index 0 — reserved (unknown / no match). */
const H_UNKNOWN = 0;
const H_ERC20_APPROVE = 1;
const H_ERC20_TRANSFER = 2;
const H_PERMIT2_APPROVE = 3;
const H_PERMIT2_PERMIT = 4;
const H_ERC7540_REQUEST = 5;
const H_ERC7540_SET_OPERATOR = 6;
const H_SWAP_ROUTER = 7;

/**
 * Selector LUT — u32 fingerprint → handler index (Buildathon judge map).
 * | Hex selector | Handler name           |
 * | 0x095ea7b3   | erc20_approve          |
 * | 0xa9059cbb   | erc20_transfer         |
 * | 0x87517c45   | permit2_approve        |
 * | 0x2a0886f7   | permit2_permit         |
 * | 0xb2d9f201   | erc7540_request_deposit|
 * | 0x710e20f1   | erc7540_request_redeem |
 * | 0x9cc233d6   | erc7540_set_operator   |
 * | 0x38ed1739   | uniswap_v2_swap_exact  |
 * | 0x7ff36ab5   | uniswap_v2_swap_eth    |
 * | 0x414bf389   | uniswap_v3_exact_input |
 * | 0xf3cd914c   | uniswap_v4_swap        |
 * | 0x5a6bcfda   | uniswap_v4_modify_liq  |
 * | 0x234266d7   | uniswap_v4_donate      |
 * | 0x48c89491   | uniswap_v4_unlock      |
 * | 0xac9650d8   | gmx_multicall          |
 */
const SELECTOR_LUT: Record<number, number> = {
  [SEL_ERC20_APPROVE]: H_ERC20_APPROVE,
  [SEL_ERC20_TRANSFER]: H_ERC20_TRANSFER,
  [SEL_PERMIT2_APPROVE]: H_PERMIT2_APPROVE,
  [SEL_PERMIT2_PERMIT]: H_PERMIT2_PERMIT,
  [SEL_ERC7540_REQUEST_DEPOSIT]: H_ERC7540_REQUEST,
  [SEL_ERC7540_REQUEST_REDEEM]: H_ERC7540_REQUEST,
  [SEL_ERC7540_SET_OPERATOR]: H_ERC7540_SET_OPERATOR,
  [SEL_UNISWAP_V2_SWAP_EXACT]: H_SWAP_ROUTER,
  [SEL_UNISWAP_V2_SWAP_ETH]: H_SWAP_ROUTER,
  [SEL_UNISWAP_V3_EXACT_INPUT_SINGLE]: H_SWAP_ROUTER,
  [SEL_UNISWAP_V4_SWAP]: H_SWAP_ROUTER,
  [SEL_UNISWAP_V4_MODIFY_LIQUIDITY]: H_SWAP_ROUTER,
  [SEL_UNISWAP_V4_DONATE]: H_SWAP_ROUTER,
  [SEL_UNISWAP_V4_UNLOCK]: H_SWAP_ROUTER,
  [SEL_GMX_MULTICALL]: H_SWAP_ROUTER,
};

const MIN_LEN_LUT: Int8Array = new Int8Array(8);
MIN_LEN_LUT[H_ERC20_APPROVE] = 4 + 64;
MIN_LEN_LUT[H_ERC20_TRANSFER] = 4 + 64;
MIN_LEN_LUT[H_PERMIT2_APPROVE] = 4 + 128;
MIN_LEN_LUT[H_PERMIT2_PERMIT] = 4;
MIN_LEN_LUT[H_ERC7540_REQUEST] = 4 + 96;
MIN_LEN_LUT[H_ERC7540_SET_OPERATOR] = 4 + 64;
MIN_LEN_LUT[H_SWAP_ROUTER] = 4;

type SelectorCtx = { to: string; byteLen: number; sel: number };

function isInfiniteApproval(amountWei: bigint): boolean {
  return amountWei === UINT256_MAX || amountWei === UINT160_MAX;
}

function decodePermit2PermitSingle(byteLen: number): { token: string; spender: string; amountWei: bigint } | null {
  if (byteLen < 4 + 96) return null;
  const head = readWordU32(CALLDATA_SCRATCH, 36, byteLen);
  let base = 36;
  if (head > 0 && head < byteLen - 4) base = 4 + head;
  if (base + 96 > byteLen) return null;
  return {
    token: readAddressAt(CALLDATA_SCRATCH, base),
    amountWei: readUint160At(CALLDATA_SCRATCH, base + 32),
    spender: readAddressAt(CALLDATA_SCRATCH, base + 64),
  };
}

function parseErc20Approve(ctx: SelectorCtx): ParsedCalldata | null {
  const amountWei = readUint256At(CALLDATA_SCRATCH, 36);
  return {
    kind: "approve",
    token: ctx.to,
    spender: readAddressAt(CALLDATA_SCRATCH, 4),
    amountWei,
    infinite: isInfiniteApproval(amountWei),
  };
}

function parseErc20Transfer(ctx: SelectorCtx): ParsedCalldata | null {
  return {
    kind: "transfer",
    token: ctx.to,
    to: readAddressAt(CALLDATA_SCRATCH, 4),
    amountWei: readUint256At(CALLDATA_SCRATCH, 36),
  };
}

function parsePermit2Approve(ctx: SelectorCtx): ParsedCalldata | null {
  const amountWei = readUint160At(CALLDATA_SCRATCH, 68);
  return {
    kind: "permit2_approve",
    permit2: ctx.to,
    token: readAddressAt(CALLDATA_SCRATCH, 4),
    spender: readAddressAt(CALLDATA_SCRATCH, 36),
    amountWei,
    infinite: isInfiniteApproval(amountWei),
  };
}

function parsePermit2Permit(ctx: SelectorCtx): ParsedCalldata | null {
  const owner = readAddressAt(CALLDATA_SCRATCH, 4);
  const single = decodePermit2PermitSingle(ctx.byteLen);
  if (!single) return null;
  return {
    kind: "permit2_permit",
    permit2: ctx.to,
    owner,
    token: single.token,
    spender: single.spender,
    amountWei: single.amountWei,
    infinite: isInfiniteApproval(single.amountWei),
  };
}

function parseErc7540Request(ctx: SelectorCtx): ParsedCalldata | null {
  return {
    kind: ctx.sel === SEL_ERC7540_REQUEST_DEPOSIT ? "erc7540_request_deposit" : "erc7540_request_redeem",
    vault: ctx.to,
    amountWei: readUint256At(CALLDATA_SCRATCH, 4),
    controller: readAddressAt(CALLDATA_SCRATCH, 36),
    owner: readAddressAt(CALLDATA_SCRATCH, 68),
  };
}

function parseErc7540SetOperator(ctx: SelectorCtx): ParsedCalldata | null {
  return {
    kind: "erc7540_set_operator",
    vault: ctx.to,
    operator: readAddressAt(CALLDATA_SCRATCH, 4),
    approved: readUint256At(CALLDATA_SCRATCH, 36) !== 0n,
  };
}

function parseSwapRouter(ctx: SelectorCtx): ParsedCalldata | null {
  return { kind: "swap", router: ctx.to, selectorU32: ctx.sel };
}

const HANDLERS: readonly ((ctx: SelectorCtx) => ParsedCalldata | null)[] = [
  () => null,
  parseErc20Approve,
  parseErc20Transfer,
  parsePermit2Approve,
  parsePermit2Permit,
  parseErc7540Request,
  parseErc7540SetOperator,
  parseSwapRouter,
];

export function dispatchSelectorCalldata(
  sel: number,
  to: string,
  byteLen: number,
): ParsedCalldata | null {
  const handlerId = SELECTOR_LUT[sel];
  if (handlerId === undefined || handlerId === H_UNKNOWN) return null;
  if (byteLen < MIN_LEN_LUT[handlerId]!) return null;
  return HANDLERS[handlerId]!({ to, byteLen, sel });
}
