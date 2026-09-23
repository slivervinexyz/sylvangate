export { SESSION_ENTROPY_SEED_CANONICAL } from "./layout-metric-provider";

export {
  EXOMESH_SESSION_SIG_HEADER,
  HONEYPOT_STATUS_CODE,
  HONEYPOT_ACTIVE,
  HONEYPOT_SIMULATED_SLIPPAGE,
  BROWSER_MIMIC_USER_AGENT,
  RPC_FETCH_TIMEOUT_MS,
  RpcNodeNotAllowlistedError,
  HoneyPotCircuitBreakError,
  isRpcDefenseAuthenticated,
  evaluateRpcDefenseGate,
  buildHoneyPotDecoyTelemetry,
  tripHoneyPotCircuit,
  assertRpcAllowlisted,
  isLayoutMetricPresent,
  type RpcFetchGateOptions,
  type RpcDefenseGateResult,
} from "./rpc-fetch-gate-lib/rpc-fetch-gate-eval";

export { fetchAllowlisted } from "./rpc-fetch-gate-lib/rpc-fetch-gate-fetch";
