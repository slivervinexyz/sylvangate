/**
 * RPC allowlist + integrity probe host filter.
 * Probe hosts remain until operator unlock is armed.
 * Unauthenticated circuit probes route to 99% synthetic slippage honeypot.
 */

export {
  ALLOWED_RPC_DOMAINS,
  HONEYPOT_RPC_HOSTS,
  listDefaultRpcHosts,
  listInternalRpcHosts,
  resolveEffectiveRpcHosts,
} from "./rpc-allowlist-hosts";

export {
  assertRpcAllowlisted,
  BROWSER_MIMIC_USER_AGENT,
  buildHoneyPotDecoyTelemetry,
  EXOMESH_SESSION_SIG_HEADER,
  evaluateRpcDefenseGate,
  fetchAllowlisted,
  HoneyPotCircuitBreakError,
  HONEYPOT_ACTIVE,
  HONEYPOT_SIMULATED_SLIPPAGE,
  HONEYPOT_STATUS_CODE,
  isLayoutMetricPresent,
  isRpcDefenseAuthenticated,
  RPC_FETCH_TIMEOUT_MS,
  RpcNodeNotAllowlistedError,
  SESSION_ENTROPY_SEED_CANONICAL,
  tripHoneyPotCircuit,
  type RpcDefenseGateResult,
  type RpcFetchGateOptions,
} from "./rpc-fetch-gate";
