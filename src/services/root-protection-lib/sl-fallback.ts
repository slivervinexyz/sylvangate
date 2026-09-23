/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

export interface SlRejectionFallbackInput {
  rejected: boolean;
  rejectionReason?: string;
  payload: import("../session-key-adapter").SessionKeyOrderPayload;
}

export interface SlRejectionFallbackResult {
  fallbackToIoc: boolean;
  iocPayload?: import("../session-key-adapter").SessionKeyOrderPayload;
  reason?: string;
}

const SL_REJECTION_PATTERN = /POST.?ONLY|DEPTH|SL_REJECT|REJECT/i;

/** SL rejection → instant Market IOC sweep fallback. */
export function resolveSlRejectionFallback(
  input: SlRejectionFallbackInput,
): SlRejectionFallbackResult {
  if (!input.rejected) {
    return { fallbackToIoc: false };
  }

  const reason = input.rejectionReason ?? "";
  if (!SL_REJECTION_PATTERN.test(reason)) {
    return { fallbackToIoc: false, reason };
  }

  return {
    fallbackToIoc: true,
    iocPayload: {
      ...input.payload,
      orderType: { limit: { tif: "Ioc" } },
    },
    reason: "SL_IOC_SWEEP_FALLBACK",
  };
}
