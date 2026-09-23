/** GMX v2 gmx-synthetics Errors.sol — decode helpers (ABI sourced from gmx-error-registry). */
import { decodeErrorResult, type Hex } from "viem";
import { GMX_ERROR_REGISTRY_ABI } from "./gmx-error-registry";

export const GMX_SYNTHETICS_ERRORS_ABI = GMX_ERROR_REGISTRY_ABI;

export function decodeGmxSyntheticsError(data: Hex): string | null {
  if (!data || data === "0x" || data.length < 10) return null;
  try {
    const decoded = decodeErrorResult({ abi: GMX_SYNTHETICS_ERRORS_ABI, data });
    const args = decoded.args?.length ? decoded.args.map(String).join(", ") : "";
    return args ? `${decoded.errorName}(${args})` : decoded.errorName;
  } catch {
    return null;
  }
}
