/**
 * Pure backend Hyperliquid Session Key adapter — dry-run mock engine + soil gate.
 *
 * SSOT note:
 * - Market data / L2 book → `services/exchanges/hyperliquid-adapter.ts` (+ `hl-l2-book.ts`)
 * - Session-key dry-run execution → **this module** (`hyperliquidAdapter.ts`)
 * - Façade re-exports → `services/hyperliquid-adapter.ts`, `adapters/hl/hyperliquid-adapter.ts`
 *
 * SPDX-License-Identifier: BUSL-1.1
 */

export type { SessionKeyPermission } from "./hl-session/permissions";
export {
  SESSION_KEY_ALLOWED_PERMISSIONS,
  assertSessionKeyPermission,
  HyperliquidAdapterError,
} from "./hl-session/permissions";

export {
  SESSION_KEY_WARNING_THRESHOLD_SEC,
  checkSessionKeyValidity,
  type SessionKeyValidityResult,
} from "./hl-session/validity";

export type {
  HyperliquidAdapterSecrets,
  HyperliquidAdapterConfig,
} from "./hl-session/config";
export { resolveHyperliquidDryRun } from "./hl-session/config";

export {
  readLastFullStateResyncAt,
  forceFullStateResync,
  registerVisibilityResyncListener,
  __resetVisibilityListenerForTests,
} from "./hl-session/visibility";

export {
  TICK_VELOCITY_SLIPPAGE_THRESHOLD,
  assertSoilResistanceForOrder,
} from "./hl-session/soil";

export type {
  ExecuteOrderInput,
  CancelOrderInput,
  HyperliquidFillResult,
  HyperliquidCancelResult,
  HyperliquidBalanceResult,
} from "./hl-session/types";

export {
  executeOrder,
  cancelOrder,
  fetchAccountBalance,
} from "./hl-session/execute";
