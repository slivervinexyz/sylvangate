export interface AttemptBudgetResult {
  allowed: boolean;
  severChannel: boolean;
  nextAttempts: number;
}

export interface IntentGateResult {
  ok: boolean;
  venueDrift: boolean;
  severChannel: boolean;
  attempts: number;
}
