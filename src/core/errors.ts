/** Pure core risk / defense errors — zero service-layer imports. */
import type { RiskLogPayload } from "./risk-log-types";

export class DefenseMatrixError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly reasons: string[];

  constructor(
    code: string,
    message: string,
    reasons: string[] = [],
    httpStatus = 403,
  ) {
    super(message);
    this.name = "DefenseMatrixError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.reasons = reasons;
  }
}

export class RiskLimitExceeded extends Error {
  readonly code = "RISK_LIMIT_EXCEEDED" as const;
  readonly httpStatus = 422 as const;
  readonly context: RiskLogPayload;

  constructor(message: string, context: RiskLogPayload) {
    super(message);
    this.name = "RiskLimitExceeded";
    this.context = context;
  }
}

export class HardlockError extends Error {
  readonly code = "HARDLOCK" as const;
  readonly httpStatus = 403 as const;
  readonly context: RiskLogPayload;

  constructor(message: string, context: RiskLogPayload) {
    super(message);
    this.name = "HardlockError";
    this.context = context;
  }
}
