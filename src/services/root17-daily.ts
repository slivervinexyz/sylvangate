import {
  computeDailyLossCapUsd,
  computeEffectiveMaxSlUsd,
  MAX_DAILY_SL_COUNT,
} from "./effective-max-sl";

export type Root17Status = "PASS" | "TRIPPED";

export interface Root17DailyState {
  /** UTC date key YYYY-MM-DD */
  utcDay: string;
  cumulativeDailyLossUsd: number;
  dailySlCount: number;
}

export interface Root17CheckResult {
  status: Root17Status;
  tripped: boolean;
  /** HTTP-style rejection when tripped */
  httpStatus: 200 | 403;
  reason?: string;
  maxDailyLossUsd: number;
  maxDailySlCount: number;
  effectiveMaxSlUsd: number;
  state: Root17DailyState;
}

export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function createRoot17DailyState(
  now: Date = new Date(),
): Root17DailyState {
  return {
    utcDay: utcDayKey(now),
    cumulativeDailyLossUsd: 0,
    dailySlCount: 0,
  };
}

/** Roll state forward when UTC day changes */
export function normalizeRoot17State(
  state: Root17DailyState,
  now: Date = new Date(),
): Root17DailyState {
  const today = utcDayKey(now);
  if (state.utcDay === today) return state;
  return createRoot17DailyState(now);
}

export function checkRoot17DailyLimit(input: {
  accountEquityUsd: number;
  state: Root17DailyState;
  now?: Date;
}): Root17CheckResult {
  const now = input.now ?? new Date();
  const state = normalizeRoot17State(input.state, now);
  const effectiveMaxSlUsd = computeEffectiveMaxSlUsd(input.accountEquityUsd);
  const maxDailyLossUsd = computeDailyLossCapUsd(input.accountEquityUsd);

  const lossTripped = state.cumulativeDailyLossUsd > maxDailyLossUsd;
  const countTripped = state.dailySlCount >= MAX_DAILY_SL_COUNT;
  const tripped = lossTripped || countTripped;

  let reason: string | undefined;
  if (lossTripped) {
    reason = `ROOT17_DAILY_LOSS_EXCEEDED: $${state.cumulativeDailyLossUsd.toFixed(2)} > $${maxDailyLossUsd.toFixed(2)} cap (Effective Max SL × 3)`;
  } else if (countTripped) {
    reason = `ROOT17_DAILY_SL_COUNT_EXCEEDED: ${state.dailySlCount} >= ${MAX_DAILY_SL_COUNT} UTC-day SL trips`;
  }

  return {
    status: tripped ? "TRIPPED" : "PASS",
    tripped,
    httpStatus: tripped ? 403 : 200,
    ...(reason !== undefined ? { reason } : {}),
    maxDailyLossUsd,
    maxDailySlCount: MAX_DAILY_SL_COUNT,
    effectiveMaxSlUsd,
    state,
  };
}

/** Record a realized stop-loss trip against the UTC-day tracker */
export function recordRoot17SlTrip(
  state: Root17DailyState,
  lossUsd: number,
  now: Date = new Date(),
): Root17DailyState {
  const normalized = normalizeRoot17State(state, now);
  return {
    utcDay: normalized.utcDay,
    cumulativeDailyLossUsd:
      normalized.cumulativeDailyLossUsd + Math.max(0, Math.abs(lossUsd)),
    dailySlCount: normalized.dailySlCount + 1,
  };
}
