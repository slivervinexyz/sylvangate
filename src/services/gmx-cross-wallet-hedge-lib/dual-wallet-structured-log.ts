/** Institutional structured logs — Wallet A (HL) × Wallet B (GMX) cross-venue SSOT. */

export function maskDualWalletAddress(addr: string): string {
  const a = addr.trim();
  return a.length >= 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function logWalletBGmxState(input: {
  walletB: string;
  ethDeltaSize: number;
  gmLiquidityUsd: number;
}): void {
  console.info(
    `[WALLET_B_GMX_STATE] walletB: ${maskDualWalletAddress(input.walletB)} | ethDeltaSize: ${input.ethDeltaSize.toFixed(4)} ETH | gmLiquidityUsd: ${fmtUsd(input.gmLiquidityUsd)}`,
  );
}

export function logWalletAHlState(input: {
  walletA: string;
  existingShortEth: number;
}): void {
  console.info(
    `[WALLET_A_HL_STATE] walletA: ${maskDualWalletAddress(input.walletA)} | existingShortEth: ${input.existingShortEth.toFixed(4)} ETH`,
  );
}

export type CrossVenueHedgeAction = "SHORT" | "COVER" | "SKIP";

export function logCrossVenueMatch(input: {
  uncoveredDeltaEth: number;
  requiredHedgeAction: CrossVenueHedgeAction;
}): void {
  console.info(
    `[CROSS_VENUE_MATCH] uncoveredDeltaEth: ${input.uncoveredDeltaEth.toFixed(4)} ETH | requiredHedgeAction: ${input.requiredHedgeAction}`,
  );
}

export function emitDualWalletHedgeTelemetry(input: {
  walletA: string;
  walletB: string;
  ethDeltaSize: number;
  gmLiquidityUsd: number;
  existingShortEth: number;
  unwind?: boolean;
}): void {
  logWalletBGmxState({
    walletB: input.walletB,
    ethDeltaSize: input.ethDeltaSize,
    gmLiquidityUsd: input.gmLiquidityUsd,
  });
  logWalletAHlState({
    walletA: input.walletA,
    existingShortEth: input.existingShortEth,
  });
  const uncovered = input.ethDeltaSize - input.existingShortEth;
  const action: CrossVenueHedgeAction = input.unwind
    ? uncovered >= 0
      ? "SKIP"
      : "COVER"
    : uncovered <= 0
      ? "SKIP"
      : "SHORT";
  logCrossVenueMatch({
    uncoveredDeltaEth: uncovered,
    requiredHedgeAction: action,
  });
}
