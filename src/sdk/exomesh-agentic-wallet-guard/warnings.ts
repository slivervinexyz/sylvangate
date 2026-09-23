/**
 * SPDX-License-Identifier: Apache-2.0
 * Plain-text retail warning generator — Robinhood C-end user alerts.
 */
import type { RetailGuardReasonCode } from "./types";

export function formatRetailWarning(
  code: RetailGuardReasonCode,
  detail: Record<string, string | number | boolean> = {},
): string {
  switch (code) {
    case "UNAUTHORIZED_SPENDER_REJECTED":
      return `ALERT: Unauthorized ERC20 approval requested for spender ${detail.spender ?? "unknown"}${detail.infinite ? " (INFINITE allowance)" : ""}.`;
    case "VENUE_DRIFT_REJECTED":
      return `ALERT: Signature blocked — contract ${detail.contract ?? "unknown"} outside session-scoped venue mandate (0-Gas pre-consensus anti-phishing).`;
    case "SLIPPAGE_EXCEEDED":
      return `ALERT: Swap blocked — estimated price impact ${detail.crossSlippage ?? "exceeds"} exceeds your safety limit (0-Gas pre-broadcast guard).`;
    case "DEPTH_INSUFFICIENT":
      return `ALERT: Swap blocked — market depth $${detail.depthUsd ?? 0} is below the minimum safety floor.`;
    case "MAX_ATTEMPTS_EXCEEDED_SEVERED":
      return `ALERT: Too many rapid submit attempts (${detail.attempts ?? 4}) — signing channel severed to prevent panic trading.`;
    case "CHANNEL_SEVERED":
      return "ALERT: Signing channel is severed — wait before retrying (FOMO throttle active).";
    case "RPC_TRANSPORT_SYNC_FAILED":
      return "ALERT: RPC transport stream synchronization anomaly — transaction execution paused to prevent nonce drift.";
    case "SEND_CALLS_BATCH_REJECTED":
      return "ALERT: EIP-5792 wallet_sendCalls batch rejected — empty or malformed calls[] (0-Gas pre-broadcast guard).";
    case "ERC7540_OPERATOR_REJECTED":
      return `ALERT: ERC-7540 async vault operator ${detail.operator ?? "unknown"} is not whitelisted — setOperator blocked (0-Gas).`;
    case "ERC7540_ASYNC_SLIPPAGE_DRIFT":
      return `ALERT: ERC-7540 async vault Pending→Claimable drift ${detail.driftBps ?? "?"}bps exceeds ${detail.maxBps ?? "?"}bps limit — request blocked (0-Gas).`;
    case "V4_HOOK_NOT_ALLOWLISTED":
      return `ALERT: Uniswap V4 hook ${detail.hook ?? "unknown"} is not allowlisted — swap blocked (0-Gas).`;
    case "V4_HOOK_FEE_EXCEEDED":
      return `ALERT: Uniswap V4 hook fee ${detail.feeBps ?? "?"}bps exceeds ${detail.maxBps ?? "?"}bps — swap blocked (0-Gas).`;
    case "V4_QUOTE_SETTLEMENT_MISMATCH":
      return `ALERT: Uniswap V4 quoted amount diverges ${detail.driftBps ?? "?"}bps from calldata — spoofed best-quote blocked (0-Gas).`;
    case "V4_UNKNOWN_SELECTOR":
      return `ALERT: Uniswap V4 PoolManager selector ${detail.selector ?? "unknown"} rejected — opaque or unknown entry (0-Gas).`;
    default:
      return `ALERT: Transaction blocked by Retail Guard (${code}).`;
  }
}
