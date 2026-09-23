/** Cron — GMX hedge drift math and rebalance action resolution. */

export const CRON_DRIFT_MIN_USD = 10 as const;
export const CRON_SKIP_CIRCUIT = "CRON_SKIP: CIRCUIT_TRIP" as const;
export const CRON_SKIP_BALANCED = "CRON_SKIP: DRIFT_BALANCED" as const;
export const CRON_UNWIND_OVERHEDGE = "CRON_UNWIND: OVERHEDGE" as const;
export const CRON_FLASH_UNWIND = "CRON_FLASH_UNWIND" as const;

export type CronRebalanceAction = "hedge" | "unwind" | "skip-balanced";

export function computeCronSignedDriftUsd(
  ethDeltaUsd: number,
  hlShortEth: number,
  ethMarkUsd: number,
): number {
  return ethDeltaUsd - hlShortEth * ethMarkUsd;
}

export function computeCronDriftUsd(
  ethDeltaUsd: number,
  hlShortEth: number,
  ethMarkUsd: number,
): number {
  return Math.max(0, computeCronSignedDriftUsd(ethDeltaUsd, hlShortEth, ethMarkUsd));
}

export function computeCronOverhedgeUsd(
  ethDeltaUsd: number,
  hlShortEth: number,
  ethMarkUsd: number,
): number {
  return Math.max(0, -computeCronSignedDriftUsd(ethDeltaUsd, hlShortEth, ethMarkUsd));
}

export function resolveCronRebalanceAction(
  driftUsd: number,
  overhedgeUsd: number,
): CronRebalanceAction {
  if (overhedgeUsd > CRON_DRIFT_MIN_USD) return "unwind";
  if (driftUsd > CRON_DRIFT_MIN_USD) return "hedge";
  return "skip-balanced";
}
