import type { GrantAuditVenueView } from "../../src/lib/gui-bridge/grant-audit/exomesh-grant-audit-metrics";

/** SSOT mock venue view for grant-audit component tests — GMX v2 + Hyperliquid core topology. */
export const GRANT_AUDIT_VENUE_MOCK_VIEW: GrantAuditVenueView = {
  gmPoolUsd: 802.43,
  legBHedgeUsd: 500,
  combinedTvlUsd: 1302.39,
  secured: true,
  oiImbalanceBadge: "[ GMX OI Imbalance Absorbed: $802.43 Neutralized ]",
  priceImpactBadge: "[ GMX PRICE IMPACT REBATE OPTIMIZER: ACTIVE (+0.02% Saved) ]",
  l1CalldataBadge: "[ ARBITRUM L1 CALLDATA SURCHARGE SHIELD: OPTIMIZED ]",
  oracleLagBadge: "[ GMX CANONICAL ORACLE LAG SHIELD: <95ms (FAIL-CLOSED) ]",
  heartbeatLabel: "[ GMX DataStore Poll: #14,892 | HL Session WS: Connected ]",
  section1Title: "Section 1 · GMX v2 GM Pool ($802.43) + Zero-Δ Neutrality Anchor",
  section2Title: "Section 2 · Leg B Session Key Hedge Adapter ($500.00 Margin/Spot)",
};
