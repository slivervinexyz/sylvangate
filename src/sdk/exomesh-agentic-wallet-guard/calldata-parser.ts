/**
 * SPDX-License-Identifier: Apache-2.0
 * Zero-dependency calldata parser — u32 LUT selector dispatch (no string split hot path).
 */
import { CALLDATA_SCRATCH, decodeHexCalldata, readSelectorU32 } from "./calldata-hex";
import { dispatchSelectorCalldata } from "./calldata-selector-lut";
import { bindTransportStreamScratch } from "./transport-stream";
import { UINT160_MAX, UINT256_MAX, type ParsedCalldata, type TxCalldataInput } from "./calldata-types";

export function parseSelector(data?: string): string {
  if (!data?.trim()) return "";
  const len = decodeHexCalldata(data, CALLDATA_SCRATCH);
  const sel = readSelectorU32(CALLDATA_SCRATCH, len);
  if (sel === 0) return "";
  return `0x${sel.toString(16).padStart(8, "0")}`;
}

export function isInfiniteApproval(amountWei: bigint): boolean {
  return amountWei === UINT256_MAX || amountWei === UINT160_MAX;
}

/** Parse `eth_sendTransaction` calldata via u32 LUT dispatch + scratch buffer. */
export function parseTransactionCalldata(tx: TxCalldataInput): ParsedCalldata | null {
  const to = tx.to?.trim().toLowerCase();
  if (!to) return null;
  const data = tx.data?.trim();
  if (!data) return { kind: "unknown", to, selectorU32: 0 };

  const byteLen = decodeHexCalldata(data, CALLDATA_SCRATCH);
  bindTransportStreamScratch(CALLDATA_SCRATCH, byteLen);
  const sel = readSelectorU32(CALLDATA_SCRATCH, byteLen);

  const parsed = dispatchSelectorCalldata(sel, to, byteLen);
  if (parsed) return parsed;

  return { kind: "unknown", to, selectorU32: sel };
}
