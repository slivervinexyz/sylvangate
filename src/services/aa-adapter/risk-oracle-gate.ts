/** SliverVineRiskOracle on-chain read + off-chain UserOp fail-closed gate (feature-flagged).
 *  Off-chain enforcement of on-chain oracle state — not ERC-7579 TYPE-4 hook execution (V1.5 Track A). */
import { createPublicClient, http, type Address } from "viem";
import { arbitrum, arbitrumNova, arbitrumSepolia } from "viem/chains";
import { RiskLimitExceeded } from "../risk-control";
import { isZeroDevAAEnabled } from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-gateway-badge";
import { ARBITRUM_ONE_CHAIN_ID, ARBITRUM_NOVA_CHAIN_ID } from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import { ARBITRUM_SEPOLIA_CHAIN_ID, resolveArbitrumRpcUrl } from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-chain";
import {
  RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
  RISK_ORACLE_FAIL_CLOSED_TRIP,
  RISK_ORACLE_LOG_CODES,
  SLIVERVINE_RISK_ORACLE_ABI,
  type RiskOracleSnapshot,
} from "./risk-oracle";
import {
  evaluateRiskOracleAdapter,
  mirrorRiskOracleLog,
} from "./risk-oracle-adapter";

export {
  RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
  RISK_ORACLE_FAIL_CLOSED_TRIP,
  type RiskOracleSnapshot,
} from "./risk-oracle";

function resolveViemChain(chainId: number) {
  if (chainId === ARBITRUM_ONE_CHAIN_ID) return arbitrum;
  if (chainId === ARBITRUM_NOVA_CHAIN_ID) return arbitrumNova;
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) return arbitrumSepolia;
  throw new Error(`risk-oracle: unsupported chainId ${chainId}`);
}

function readEnv(env?: Record<string, string>): Record<string, string> {
  if (env) return env;
  return typeof process !== "undefined" ? (process.env as Record<string, string>) : {};
}

export function resolveSliverVineRiskOracleAddress(
  env?: Record<string, string>,
): Address | undefined {
  const e = readEnv(env);
  const raw =
    e.SLIVERVINE_RISK_ORACLE_ADDRESS?.trim() ||
    e.SILVERVINE_RISK_ORACLE_ADDRESS?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{40}$/.test(raw)) return undefined;
  return raw as Address;
}

/** @deprecated Use resolveSliverVineRiskOracleAddress */
export const resolveSilverVineRiskOracleAddress = resolveSliverVineRiskOracleAddress;

export function isRiskOracleUserOpBlocked(snapshot: RiskOracleSnapshot): boolean {
  return snapshot.isSystemFlushed || snapshot.statusCode === RISK_ORACLE_FAIL_CLOSED_STATUS_CODE;
}

export function evaluateRiskOracleUserOpGate(snapshot: RiskOracleSnapshot): {
  allowed: boolean;
  reason?: string;
} {
  const verdict = evaluateRiskOracleAdapter(snapshot);
  if (verdict.allowed) return { allowed: true };
  if (verdict.logCode) mirrorRiskOracleLog(verdict.logCode, "zerodev-userop-gate");
  return {
    allowed: false,
    reason: `${RISK_ORACLE_FAIL_CLOSED_TRIP}:${verdict.reason ?? "BLOCKED"}:statusCode=${snapshot.statusCode}`,
  };
}

export function assertRiskOracleUserOpGate(snapshot: RiskOracleSnapshot): void {
  const verdict = evaluateRiskOracleUserOpGate(snapshot);
  if (verdict.allowed) return;
  throw new RiskLimitExceeded(verdict.reason ?? RISK_ORACLE_FAIL_CLOSED_TRIP, {
    level: "warn",
    module: "risk-control",
    event: "ROOT_PROTECTION_TRIP",
    symbol: "AA",
    timestamp: new Date().toISOString(),
    message: RISK_ORACLE_FAIL_CLOSED_TRIP,
    details: {
      gate: "zerodev-kernel-adapter",
      isSystemFlushed: snapshot.isSystemFlushed,
      statusCode: snapshot.statusCode,
      logCode: RISK_ORACLE_LOG_CODES.SLO_TIMEOUT,
    },
  });
}

export async function readSliverVineRiskOracleState(input: {
  oracleAddress: Address;
  chainId: number;
  rpcUrl?: string;
  env?: Record<string, string>;
}): Promise<RiskOracleSnapshot> {
  const env = readEnv(input.env);
  const rpcUrl = input.rpcUrl ?? resolveArbitrumRpcUrl(env, input.chainId);
  const client = createPublicClient({
    chain: resolveViemChain(input.chainId),
    transport: http(rpcUrl),
  });
  const [isSystemFlushed, statusCode, lastTimestamp] = await Promise.all([
    client.readContract({
      address: input.oracleAddress,
      abi: SLIVERVINE_RISK_ORACLE_ABI,
      functionName: "isSystemFlushed",
    }),
    client.readContract({
      address: input.oracleAddress,
      abi: SLIVERVINE_RISK_ORACLE_ABI,
      functionName: "statusCode",
    }),
    client.readContract({
      address: input.oracleAddress,
      abi: SLIVERVINE_RISK_ORACLE_ABI,
      functionName: "lastTimestamp",
    }),
  ]);
  return { isSystemFlushed, statusCode: Number(statusCode), lastTimestamp };
}

/** @deprecated Use readSliverVineRiskOracleState */
export const readSilverVineRiskOracleState = readSliverVineRiskOracleState;

export function shouldEnforceRiskOracleGate(env?: Record<string, string>): boolean {
  return isZeroDevAAEnabled(env) && Boolean(resolveSliverVineRiskOracleAddress(env));
}

export async function assertRiskOracleUserOpGateOnChain(input: {
  chainId: number;
  rpcUrl?: string;
  env?: Record<string, string>;
  oracleAddress?: Address;
  snapshot?: RiskOracleSnapshot;
}): Promise<RiskOracleSnapshot | null> {
  const env = readEnv(input.env);
  if (!isZeroDevAAEnabled(env)) return null;

  const oracleAddress = input.oracleAddress ?? resolveSliverVineRiskOracleAddress(env);
  if (!oracleAddress) return null;

  const snapshot =
    input.snapshot ??
    (await readSliverVineRiskOracleState({
      oracleAddress,
      chainId: input.chainId,
      rpcUrl: input.rpcUrl,
      env,
    }));
  assertRiskOracleUserOpGate(snapshot);
  return snapshot;
}
