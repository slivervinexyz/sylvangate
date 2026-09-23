/** GMX micro-fill simulateContract revert decode helpers. */
import {
  BaseError, ContractFunctionRevertedError, type Hex,
} from "viem";
import { interpretGmxRevertData } from "./gmx-error-interpreter";
import { labelGmxSyntheticsError, type GmxSyntheticsErrorLabel } from "./gmx-synthetics-error-labels";

export type GmxSimulateRevertDetails = {
  message: string;
  reason?: string;
  signature?: string;
  rawData?: Hex;
  decodedError?: string;
  errorLabel?: GmxSyntheticsErrorLabel;
  causeData?: string;
};

function readHexData(value: unknown): Hex | undefined {
  if (typeof value !== "string" || !value.startsWith("0x")) return undefined;
  return value as Hex;
}

function scrapeRevertData(err: unknown, depth = 0): Hex | undefined {
  if (!err || typeof err !== "object" || depth > 6) return undefined;
  const o = err as Record<string, unknown>;
  for (const key of ["data", "raw", "result"]) {
    const hex = readHexData(o[key]);
    if (hex && hex.length > 10) return hex;
  }
  return scrapeRevertData(o.cause, depth + 1);
}

function formatDecodedContractError(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const { errorName, args } = data as { errorName?: string; args?: readonly unknown[] };
  if (!errorName) return undefined;
  if (errorName === "Error" && args?.[0] != null) return `Error("${String(args[0])}")`;
  if (errorName === "Panic" && args?.[0] != null) return `Panic(0x${BigInt(args[0] as bigint).toString(16)})`;
  return args?.length ? `${errorName}(${args.map(String).join(", ")})` : errorName;
}

export function decodeGmxRevertData(data: Hex): string | null {
  const interpreted = interpretGmxRevertData(data);
  return interpreted.silent ? null : interpreted.decoded;
}

function attachErrorLabel(decoded?: string): { decodedError?: string; errorLabel?: GmxSyntheticsErrorLabel } {
  if (!decoded) return {};
  const stripped = decoded.replace(/^\[GMX:[^\]]+\]\s*/, "");
  const label = labelGmxSyntheticsError(stripped);
  return { decodedError: decoded, errorLabel: label };
}

export function extractGmxSimulateRevertDetails(err: unknown): GmxSimulateRevertDetails {
  const parts: string[] = [];
  let reason: string | undefined;
  let signature: string | undefined;
  let rawData: Hex | undefined;
  let decodedError: string | undefined;
  let errorLabel: GmxSyntheticsErrorLabel | undefined;
  const causeData = scrapeRevertData(err);

  if (err instanceof BaseError) {
    const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (rev instanceof ContractFunctionRevertedError) {
      reason = rev.reason;
      signature = rev.signature;
      rawData = readHexData((rev as { raw?: unknown }).raw) ?? scrapeRevertData(rev);
      decodedError = formatDecodedContractError(rev.data) ?? undefined;
      if (reason) parts.push(`reason=${reason}`);
      if (signature) parts.push(`signature=${signature}`);
      if (rawData) {
        parts.push(`rawData=${rawData}`);
        decodedError = decodedError ?? decodeGmxRevertData(rawData) ?? undefined;
        if (decodedError) ({ errorLabel } = attachErrorLabel(decodedError));
      }
      if (decodedError) parts.push(`decoded=${decodedError}`);
      if (errorLabel) parts.push(`label=${errorLabel}`);
    }
    if (causeData && causeData !== rawData) {
      parts.push(`causeData=${causeData}`);
      if (!decodedError) decodedError = decodeGmxRevertData(causeData) ?? undefined;
      if (decodedError) ({ errorLabel } = attachErrorLabel(decodedError));
      if (decodedError && !parts.some((p) => p.startsWith("decoded="))) parts.push(`decoded=${decodedError}`);
      if (errorLabel && !parts.some((p) => p.startsWith("label="))) parts.push(`label=${errorLabel}`);
    }
    if (parts.length === 0) parts.push(err.shortMessage ?? err.message);
  } else {
    parts.push(err instanceof Error ? err.message : String(err));
    if (causeData) {
      rawData = causeData;
      decodedError = decodeGmxRevertData(causeData) ?? undefined;
      ({ errorLabel } = attachErrorLabel(decodedError));
      parts.push(`causeData=${causeData}`);
      if (decodedError) parts.push(`decoded=${decodedError}`);
      if (errorLabel) parts.push(`label=${errorLabel}`);
    }
  }
  return { message: parts.join(" | "), reason, signature, rawData, decodedError, errorLabel, causeData };
}

export function formatGmxSimulateRevert(err: unknown): string {
  return extractGmxSimulateRevertDetails(err).message;
}

function isEmptyRevertHex(hex?: string): boolean {
  return hex === "0x" || hex === "";
}

export function isSilentGmxSimulateRevert(err: unknown): boolean {
  const { rawData, causeData } = extractGmxSimulateRevertDetails(err);
  if (isEmptyRevertHex(rawData) || isEmptyRevertHex(causeData)) return true;
  if (err instanceof BaseError) {
    const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (rev instanceof ContractFunctionRevertedError) {
      const raw = readHexData((rev as { raw?: unknown }).raw);
      if (isEmptyRevertHex(raw)) return true;
    }
  }
  return false;
}
