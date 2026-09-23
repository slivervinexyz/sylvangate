/**
 * GMX v2 Error Decoding & Diagnostic Subsystem — structured operator guidance beyond gmx-interface.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeAbiParameters,
  decodeErrorResult,
  type Hex,
} from "viem";
import { buildGmxErrorAdjustments, buildGmxErrorGuidance } from "./gmx-error-guidance";
import {
  GMX_ERROR_REGISTRY_ABI,
  lookupGmxErrorDefinition,
} from "./gmx-error-registry";
import type { GmxInterpretContext, GmxInterpretedError } from "./gmx-error-interpreter.types";
import { labelGmxSyntheticsError } from "./gmx-synthetics-error-labels";

const ERROR_STRING_SELECTOR = "0x08c379a0";
const PANIC_SELECTOR = "0x4e487b71";

function readHex(value: unknown): Hex | undefined {
  return typeof value === "string" && value.startsWith("0x") ? (value as Hex) : undefined;
}

function scrapeRevertHex(err: unknown, depth = 0): Hex | undefined {
  if (!err || typeof err !== "object" || depth > 6) return undefined;
  const o = err as Record<string, unknown>;
  for (const key of ["data", "raw", "result"]) {
    const hex = readHex(o[key]);
    if (hex && hex.length > 2) return hex;
  }
  return scrapeRevertHex(o.cause, depth + 1);
}

function formatArgs(args: readonly unknown[]): string {
  return args.length ? args.map(String).join(", ") : "";
}

export function interpretGmxRevertData(data: Hex, ctx: GmxInterpretContext = {}): GmxInterpretedError {
  const silent = !data || data === "0x" || data.length < 10;
  if (silent) {
    return {
      selector: "0x" as Hex,
      errorName: "SilentRevert",
      domain: "Unknown",
      category: "SilentRevert",
      args: [],
      decoded: "SilentRevert(0x)",
      summary: "EVM revert with empty returndata — typical of internal require(false) or consumed custom error in delegatecall",
      guidance: [
        "Run probeIsolatedGmxCreateOrderRevert to isolate createOrder after funding legs",
        "Use forge test GmxLocalForkTraceTest -vvvv or debug_traceTransaction on fallback RPC",
        "Alchemy eth_call often strips custom error payloads — set GMX_DIAGNOSTIC_RPC_URL",
      ],
      rawData: (data ?? "0x") as Hex,
      silent: true,
    };
  }
  const selector = data.slice(0, 10) as Hex;
  try {
    const decoded = decodeErrorResult({ abi: GMX_ERROR_REGISTRY_ABI, data });
    const def = lookupGmxErrorDefinition(decoded.errorName);
    const args = decoded.args ?? [];
    const decodedStr = args.length ? `${decoded.errorName}(${formatArgs(args)})` : decoded.errorName;
    const label = labelGmxSyntheticsError(decoded.errorName);
    const guidance = buildGmxErrorGuidance(decoded.errorName, args, ctx);
    const adjustments = buildGmxErrorAdjustments(decoded.errorName, args, ctx);
    return {
      selector,
      errorName: decoded.errorName,
      domain: def.domain,
      category: def.category,
      label,
      args,
      decoded: label ? `[GMX:${label}] ${decodedStr}` : decodedStr,
      summary: def.summary,
      guidance,
      rawData: data,
      silent: false,
      adjustments,
    };
  } catch {
    if (selector === ERROR_STRING_SELECTOR) {
      const [msg] = decodeAbiParameters([{ type: "string" }], `0x${data.slice(10)}` as Hex);
      return {
        selector, errorName: "Error", domain: "Unknown", category: "Generic", args: [msg],
        decoded: `Error("${msg}")`, summary: String(msg), guidance: ["Solidity Error(string) revert from nested call"],
        rawData: data, silent: false,
      };
    }
    if (selector === PANIC_SELECTOR) {
      const [code] = decodeAbiParameters([{ type: "uint256" }], `0x${data.slice(10)}` as Hex);
      return {
        selector, errorName: "Panic", domain: "Unknown", category: "Generic", args: [code],
        decoded: `Panic(0x${code.toString(16)})`, summary: `Solidity panic 0x${code.toString(16)}`,
        guidance: ["Check arithmetic overflow / division-by-zero in nested GMX library"],
        rawData: data, silent: false,
      };
    }
    return {
      selector, errorName: "UnknownCustomError", domain: "Unknown", category: "Generic", args: [],
      decoded: `CustomError(selector=${selector})`, summary: `Undecoded selector ${selector}`,
      guidance: ["Cross-check selector against gmx-synthetics contracts/error/Errors.sol"],
      rawData: data, silent: false,
    };
  }
}

export function interpretGmxViemError(err: unknown, ctx: GmxInterpretContext = {}): GmxInterpretedError {
  let raw = scrapeRevertHex(err) ?? ("0x" as Hex);
  if (err instanceof BaseError) {
    const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (rev instanceof ContractFunctionRevertedError) {
      raw = readHex((rev as { raw?: unknown }).raw) ?? raw;
    }
  }
  return interpretGmxRevertData(raw, ctx);
}

export function formatGmxInterpretedError(err: GmxInterpretedError): string {
  const lines = [err.decoded, `Domain: ${err.domain} | Category: ${err.category}`, err.summary];
  if (err.adjustments?.acceptablePrice) {
    const a = err.adjustments.acceptablePrice;
    lines.push(`Price adjustment: current=${a.current} suggested=${a.suggested} drift=${a.deltaBps}bps`);
  }
  if (err.adjustments?.executionFee) {
    const f = err.adjustments.executionFee;
    lines.push(`Fee adjustment: current=${f.current} min=${f.minimum} deficit=${f.deficit}`);
  }
  if (err.guidance.length) {
    lines.push("Guidance:");
    for (const g of err.guidance) lines.push(`  • ${g}`);
  }
  return lines.join("\n");
}

export { GMX_ERROR_REGISTRY_ABI } from "./gmx-error-registry";
export type { GmxInterpretContext, GmxInterpretedError } from "./gmx-error-interpreter.types";
