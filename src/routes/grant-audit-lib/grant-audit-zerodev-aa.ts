/** Grant audit — ZeroDev AA gateway badge status for HUD telemetry. */
import type { Env } from "../../env";
import { resolveGrantAuditEnv } from "../../env-grant-defaults";
import {
  evaluateZeroDevAaGatewayBadge,
  type ZeroDevAaGatewayBadgeStatus,
} from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-gateway-badge";

const HUD_SOIL_PROBE = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  at: new Date(),
};

export function buildZeroDevAaGatewayStatus(env: Env): ZeroDevAaGatewayBadgeStatus {
  return evaluateZeroDevAaGatewayBadge(
    HUD_SOIL_PROBE,
    resolveGrantAuditEnv(env) as Record<string, string>,
  );
}
