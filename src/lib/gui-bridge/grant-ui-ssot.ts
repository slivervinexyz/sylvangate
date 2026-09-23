/** Grant documentation SSOT — mirrored in SUBMISSION / HYPERLIQUID grant pack. */
import { DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS } from "../../env-grant-defaults";

export const GRANT_VITEST_SSOT_LABEL =
  "1108 Vitest PASS (238 test files, 100% Clean)" as const;

export const GRANT_TOXIC_FILL_MITIGATION_LABEL =
  "Toxic-Fill & Stale-Book Mitigation" as const;

export const GRANT_AUDIT_EXECUTION_PENDING_STATUS =
  "[ ⏳ Live Telemetry Pending ]" as const;

/** HL mainnet session-key master wallet — OID-verified fill anchor (not L1 tx hash). */
export const GRANT_AUDIT_HL_MAINNET_SESSION_WALLET =
  DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS;

/** Verified live mainnet perp fill — HL order id (provenance SSOT). */
export const GRANT_AUDIT_HL_MAINNET_OID = "513344575969" as const;

export const GRANT_AUDIT_HL_MAINNET_SHORT_SIZE_ETH = 0.2223 as const;

/** Verified Arbitrum One GMX v2 Exchange Router multicall — arbiscan.io. */
export const GRANT_AUDIT_GMX_ARBITRUM_TX_HASH =
  "0x9af4d7224639e5e72289fec7688ecbff19978ecf84d1bb06471ef1daf129f760" as const;

export const GRANT_AUDIT_HL_MAINNET_EXPLORER_ADDRESS_BASE =
  "https://app.hyperliquid.xyz/explorer/address/" as const;

export const GRANT_AUDIT_ARBITRUM_EXPLORER_TX_BASE = "https://arbiscan.io/tx/" as const;

export function buildGrantAuditHlMainnetSessionExplorerUrl(
  address = GRANT_AUDIT_HL_MAINNET_SESSION_WALLET,
): string {
  return `${GRANT_AUDIT_HL_MAINNET_EXPLORER_ADDRESS_BASE}${address}`;
}

export function buildGrantAuditArbitrumExplorerUrl(hash: string): string {
  return `${GRANT_AUDIT_ARBITRUM_EXPLORER_TX_BASE}${hash}`;
}

/** SilverVine Labs corporate site — entity URL (Sil-). */
export const SILVERVINE_PROTOCOL_SHIELD_URL = "https://silvervinelabs.com" as const;

export const SLIVERVINE_HUD_DAPP_NODE_URL =
  "https://bedeltawater.slivervine.xyz" as const;

/** @deprecated Use SLIVERVINE_HUD_DAPP_NODE_URL — protocol brand SSOT is SliverVine. */
export const SILVERVINE_HUD_DAPP_NODE_URL = SLIVERVINE_HUD_DAPP_NODE_URL;

export const TELEMETRY_HEALTH_API_URL =
  `${SLIVERVINE_HUD_DAPP_NODE_URL}/api/telemetry/health` as const;

export const TELEMETRY_ANALYTICS_API_URL =
  `${SLIVERVINE_HUD_DAPP_NODE_URL}/api/telemetry/analytics` as const;

export const TELEMETRY_HEALTH_CURL =
  `curl -s "${TELEMETRY_HEALTH_API_URL}"` as const;

export const TELEMETRY_ANALYTICS_CURL =
  `curl -s "${TELEMETRY_ANALYTICS_API_URL}"` as const;

export const TELEMETRY_API_COPY_COMMAND =
  `${TELEMETRY_HEALTH_CURL}\n${TELEMETRY_ANALYTICS_CURL}` as const;
