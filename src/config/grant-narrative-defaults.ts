/** GRANT_NARRATIVE_FALLBACK_ONLY — demo/E2E narrative; never mainnet live sizing. */

export const GRANT_NARRATIVE_FALLBACK_ONLY = {
  totalVaultCapitalUsd: 2_500,
  gmxDepositUsd: 2_400,
  ethPriceUsd: 3_465,
  gmEthLegShare: 0.5,
  token: "USDC",
} as const;

export const GRANT_AUDIT_SWR_FALLBACK_LOG_TAG = "[GRANT_AUDIT_SWR_FALLBACK_ONLY]" as const;
