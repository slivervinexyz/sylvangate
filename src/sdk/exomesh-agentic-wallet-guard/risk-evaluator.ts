/**
 * SPDX-License-Identifier: Apache-2.0
 * Unified retail risk evaluator — calldata · EIP-712 · soil · intent gates.
 */
import { parseTransactionCalldata } from "./calldata-parser";
import { isUniswapV4Selector } from "./calldata-types";
import { evaluateErc7540FromParsedCalldata } from "./erc7540-async-escort";
import {
  evaluateRpcTransportProtocol,
  evaluateRetailApproveGate,
  evaluateRetailIntentGate,
  evaluateRetailSoilGate,
  evaluateRetailVenueAllowlist,
  resolveVenueBitFromContract,
} from "./guard-engine";
import type { RetailGuardConfig, RetailGuardRejectPayload, RetailSoilQuote } from "./types";
import { evaluateUniswapV4HookGate } from "../../adapters/uniswap-v4-hook-guard";

export interface ParsedTypedData {
  verifyingContract?: string;
  spender?: string;
  chainId?: number;
}

function parseTx(params: unknown[]): { to?: string; data?: string } | null {
  const tx = params[0];
  if (!tx || typeof tx !== "object") return null;
  const rec = tx as { to?: string; data?: string };
  return { to: rec.to, data: rec.data };
}

export function parseTypedDataPayload(params: unknown[]): ParsedTypedData {
  const raw = params[1];
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as {
      domain?: { verifyingContract?: string; chainId?: number };
      message?: { spender?: string };
    };
    return {
      verifyingContract: parsed.domain?.verifyingContract,
      chainId: typeof parsed.domain?.chainId === "number" ? parsed.domain.chainId : undefined,
      spender: typeof parsed.message?.spender === "string" ? parsed.message.spender : undefined,
    };
  } catch {
    return {};
  }
}

function resolveSoilQuote(
  config: RetailGuardConfig,
  method: string,
  params: unknown[],
): RetailSoilQuote | null {
  if (config.resolveSoilQuote) return config.resolveSoilQuote(method, params);
  if (method !== "eth_sendTransaction") return null;
  const parsed = parseTransactionCalldata(parseTx(params) ?? {});
  if (parsed?.kind === "swap" && config.soilQuote) return config.soilQuote;
  if (config.soilQuote) return config.soilQuote;
  return null;
}

function resolveVenueBit(
  config: RetailGuardConfig,
  method: string,
  params: unknown[],
): number {
  if (config.resolveVenueBit) return config.resolveVenueBit(method, params);
  if (method === "eth_sendTransaction") {
    return resolveVenueBitFromContract(parseTx(params)?.to, config.contractVenueIndex);
  }
  if (method === "eth_signTypedData_v4") {
    const td = parseTypedDataPayload(params);
    return resolveVenueBitFromContract(td.verifyingContract, config.contractVenueIndex);
  }
  return 0;
}

export interface RetailRiskEvalOptions {
  skipTransport?: boolean;
  skipIntentGate?: boolean;
}

/** Run full retail risk stack for a guarded EIP-1193 method. */
export function evaluateRetailRisk(
  config: RetailGuardConfig,
  method: string,
  params: unknown[],
  options?: RetailRiskEvalOptions,
): RetailGuardRejectPayload | null {
  if (!options?.skipTransport) {
    const transportReject = evaluateRpcTransportProtocol(config);
    if (transportReject) return transportReject;
  }

  if (method === "eth_sendTransaction") {
    const tx = parseTx(params);
    const parsed = tx ? parseTransactionCalldata(tx) : null;

    if (tx) {
      const sel = parsed && "selectorU32" in parsed ? parsed.selectorU32 : 0;
      if (isUniswapV4Selector(sel) || (tx.to && config.v4PoolManagers?.length)) {
        const v4Reject = evaluateUniswapV4HookGate(tx.to, tx.data, config, parsed);
        if (v4Reject) return v4Reject;
      }
    }

    if (
      parsed?.kind === "approve" ||
      parsed?.kind === "permit2_approve" ||
      parsed?.kind === "permit2_permit"
    ) {
      const approveReject = evaluateRetailApproveGate(
        {
          kind: "approve",
          token: parsed.token,
          spender: parsed.spender,
          amountWei: parsed.amountWei,
          infinite: parsed.infinite,
        },
        config,
      );
      if (approveReject) return approveReject;
    }

    if (parsed) {
      const erc7540Reject = evaluateErc7540FromParsedCalldata(parsed, config);
      if (erc7540Reject) return erc7540Reject;
    }

    if (tx?.to) {
      const venueReject = evaluateRetailVenueAllowlist(tx.to, config);
      if (venueReject) return venueReject;
    }
  }

  if (method === "eth_signTypedData_v4") {
    const td = parseTypedDataPayload(params);
    const venueReject = evaluateRetailVenueAllowlist(td.verifyingContract, config);
    if (venueReject) return venueReject;

    if (td.spender && config.allowedSpenders?.length) {
      const norm = td.spender.trim().toLowerCase();
      const allowed = config.allowedSpenders.some((s) => s.trim().toLowerCase() === norm);
      if (!allowed) {
        return {
          code: "UNAUTHORIZED_SPENDER_REJECTED",
          message: `UNAUTHORIZED_SPENDER_REJECTED:permit_spender=${norm}`,
          plainTextWarning: `ALERT: EIP-712 Permit requests approval for untrusted spender ${norm}.`,
        };
      }
    }
  }

  const soilQuote = resolveSoilQuote(config, method, params);
  if (soilQuote) {
    const soilReject = evaluateRetailSoilGate(soilQuote, config.preferWasm !== false);
    if (soilReject) return soilReject;
  }

  if (options?.skipIntentGate) return null;

  const venueBit = resolveVenueBit(config, method, params);
  return evaluateRetailIntentGate(config, venueBit);
}
