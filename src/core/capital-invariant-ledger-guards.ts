/** Mainnet live-input guards for capital invariant ledger. */
import type { CapitalLedgerParams } from "./capital-invariant-ledger-types";

export function isMainnetLiveMode(): boolean {
  return process.env.IS_MAINNET === "true";
}

export function assertLiveCapitalLedgerInputs(params: CapitalLedgerParams): void {
  if (!isMainnetLiveMode()) return;
  if (params.grantNarrativeFallback) {
    throw new Error("CAPITAL_LEDGER_MAINNET_GRANT_FALLBACK_FORBIDDEN");
  }
  const required: Array<[string, number | undefined]> = [
    ["totalVaultCapitalUsd", params.totalVaultCapitalUsd],
    ["gmxDepositUsd", params.gmxDepositUsd],
    ["ethPriceUsd", params.ethPriceUsd],
  ];
  for (const [key, value] of required) {
    if (!(typeof value === "number" && Number.isFinite(value) && value > 0)) {
      throw new Error(`CAPITAL_LEDGER_LIVE_INPUT_REQUIRED:${key}`);
    }
  }
}

export function buildLiveCapitalLedgerParams(input: {
  gmLiquidityUsd: number;
  hlMarginUsd: number;
  ethPriceUsd: number;
  spotUsdcUsd?: number;
}): CapitalLedgerParams {
  const gmLiquidityUsd = Math.max(0, input.gmLiquidityUsd);
  const hlMarginUsd = Math.max(0, input.hlMarginUsd);
  const spotUsdcUsd = Math.max(0, input.spotUsdcUsd ?? 0);
  return {
    totalVaultCapitalUsd: gmLiquidityUsd + hlMarginUsd + spotUsdcUsd,
    gmxDepositUsd: gmLiquidityUsd,
    ethPriceUsd: input.ethPriceUsd,
    provenance: "live-rpc",
  };
}
