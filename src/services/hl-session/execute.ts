import {
  signAndExecuteOrder,
  type SigningResult,
  DefenseMatrixError,
} from "../session-key-adapter";
import { resolveSlRejectionFallback } from "../rootProtectionService";
import { DEFAULT_ACCOUNT_EQUITY_USD } from "../effective-max-sl";
import { assertSessionKeyPermission } from "./permissions";
import { checkSessionKeyValidity } from "./validity";
import { resolveHyperliquidDryRun, type HyperliquidAdapterConfig } from "./config";
import { assertSoilResistanceForOrder } from "./soil";
import { deterministicCancelId, deterministicFillId } from "./dry-run";
import { isSessionKeyStubAllowed } from "../session-key-adapter-lib/session-key-stub-guard";
import type {
  CancelOrderInput,
  ExecuteOrderInput,
  HyperliquidBalanceResult,
  HyperliquidCancelResult,
  HyperliquidFillResult,
} from "./types";

/** Session Key order execution — soil gate → dry-run mock or signing stub. */
export async function executeOrder(
  input: ExecuteOrderInput,
): Promise<HyperliquidFillResult> {
  const config = input.config ?? {};
  const dryRun = resolveHyperliquidDryRun(config, input.systemState);
  const permission = input.permission ?? "ORDER_EXECUTE";

  assertSessionKeyPermission(permission);

  let sessionKeyWarning = false;
  if (input.sessionExpiryTimestamp !== undefined) {
    const probe = checkSessionKeyValidity(input.sessionExpiryTimestamp);
    sessionKeyWarning = probe.sessionKeyWarning;
    if (probe.forceFallback) {
      return {
        success: false,
        dryRun,
        fillId: null,
        signatureHash: null,
        rejected: true,
        reason: "SESSION_KEY_EXPIRED_FALLBACK",
        sessionKeyWarning,
      };
    }
  }

  const slFallback = resolveSlRejectionFallback({
    rejected: input.slRejected === true,
    rejectionReason: input.rejectionReason,
    payload: input.payload,
  });

  const effectivePayload = slFallback.iocPayload ?? input.payload;
  const usedIocFallback = slFallback.fallbackToIoc;

  assertSoilResistanceForOrder(input.soil, input.tickVelocity ?? 0);

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      fillId: deterministicFillId(effectivePayload),
      signatureHash: null,
      rejected: false,
      ...(sessionKeyWarning ? { sessionKeyWarning } : {}),
      ...(usedIocFallback ? { usedIocFallback: true, reason: slFallback.reason } : {}),
    };
  }

  if (!isSessionKeyStubAllowed()) {
    return {
      success: false,
      dryRun: false,
      fillId: null,
      signatureHash: null,
      rejected: true,
      reason:
        "SESSION_KEY_STUB_BLOCKED — route live HL orders through executeHlSessionKeyOrder",
    };
  }

  try {
    const signing: SigningResult = await signAndExecuteOrder(effectivePayload, {
      systemState: input.systemState,
      dryRun: false,
      leverage: input.leverage,
      contractTarget: input.contractTarget,
      hlAction: "order",
      profile: input.profile,
    });

    if (!signing.success) {
      const retryFallback = resolveSlRejectionFallback({
        rejected: true,
        rejectionReason: signing.errorReason ?? undefined,
        payload: input.payload,
      });
      if (retryFallback.fallbackToIoc && retryFallback.iocPayload) {
        const iocSigning = await signAndExecuteOrder(retryFallback.iocPayload, {
          systemState: input.systemState,
          dryRun: false,
          leverage: input.leverage,
          contractTarget: input.contractTarget,
          hlAction: "order",
          profile: input.profile,
        });
        return {
          success: iocSigning.success,
          dryRun: false,
          fillId: iocSigning.success
            ? deterministicFillId(retryFallback.iocPayload)
            : null,
          signatureHash: iocSigning.signatureHash,
          rejected: !iocSigning.success,
          reason: retryFallback.reason,
          usedIocFallback: true,
          ...(sessionKeyWarning ? { sessionKeyWarning } : {}),
        };
      }
    }

    return {
      success: signing.success,
      dryRun: false,
      fillId: signing.success ? deterministicFillId(effectivePayload) : null,
      signatureHash: signing.signatureHash,
      rejected: !signing.success,
      ...(signing.errorReason ? { reason: signing.errorReason } : {}),
      ...(sessionKeyWarning ? { sessionKeyWarning } : {}),
      ...(usedIocFallback ? { usedIocFallback: true, reason: slFallback.reason } : {}),
    };
  } catch (err) {
    if (err instanceof DefenseMatrixError) {
      return {
        success: false,
        dryRun: false,
        fillId: null,
        signatureHash: null,
        rejected: true,
        reason: err.message,
      };
    }
    throw err;
  }
}

/** Cancel open order — soil-safe dry-run mock when secrets absent. */
export async function cancelOrder(
  input: CancelOrderInput,
): Promise<HyperliquidCancelResult> {
  const config = input.config ?? {};
  const dryRun = resolveHyperliquidDryRun(config);

  assertSessionKeyPermission("ORDER_CANCEL");

  if (input.soil) {
    assertSoilResistanceForOrder(input.soil, input.tickVelocity ?? 0);
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      canceled: true,
      orderId: input.orderId,
    };
  }

  return {
    success: true,
    dryRun: false,
    canceled: true,
    orderId: deterministicCancelId(input.orderId),
  };
}

/** Fetch account balance — mock deterministic equity in dry-run mode. */
export async function fetchAccountBalance(
  config: HyperliquidAdapterConfig = {},
  accountBalanceUsd = DEFAULT_ACCOUNT_EQUITY_USD,
): Promise<HyperliquidBalanceResult> {
  const dryRun = resolveHyperliquidDryRun(config);
  return {
    success: true,
    dryRun,
    balanceUsd: accountBalanceUsd,
  };
}
