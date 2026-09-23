/**
 * SystemState — authoritative state builders (re-export shell; SSOT: core).
 */
export {
  buildSystemState,
  buildSystemStateFromSignals,
  buildBlockedSystemState,
  serializeSystemStateForClient,
} from "../../core/system-state-build";

export { deriveCriFromRiskSignals, resolveHudState } from "../../core/system-state-cri";

export type {
  BuildSystemStateInput,
  HudState,
  RiskSignalSnapshot,
  SessionKeyRuntimeMode,
  SessionKeyStatusTag,
  SystemState,
} from "../../core/system-state-types";

export { DEFAULT_ACCOUNT_BALANCE_USD } from "../../core/system-state-types";
