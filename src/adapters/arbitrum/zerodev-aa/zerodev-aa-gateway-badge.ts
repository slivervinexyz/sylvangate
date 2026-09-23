/** HUD badge + feature flag — lean worker import (no full zerodev-aa-gate). */
import { checkSoilResistance } from "../../../services/risk-control";
import type { SoilResistanceInput } from "../../../services/risk-control-lib/soil-resistance";
import {
  AA_GATEWAY_DISABLED_LABEL,
  AA_GATEWAY_SECURED_LABEL,
  type ZeroDevAaGatewayBadgeStatus,
} from "./zerodev-aa-gate-types";

export { AA_GATEWAY_DISABLED_LABEL, AA_GATEWAY_SECURED_LABEL };
export type { ZeroDevAaGatewayBadgeStatus };

export function isZeroDevAAEnabled(env?: Record<string, string>): boolean {
  const e =
    env ??
    (typeof process !== "undefined" ? (process.env as Record<string, string>) : {});
  return e.USE_ZERODEV_AA === "true";
}

export function evaluateZeroDevAaGatewayBadge(
  soil: SoilResistanceInput,
  env?: Record<string, string>,
): ZeroDevAaGatewayBadgeStatus {
  const enabled = isZeroDevAAEnabled(env);
  if (!enabled) {
    return { enabled: false, gatePass: false, secured: false, label: AA_GATEWAY_DISABLED_LABEL };
  }
  const gatePass = !checkSoilResistance(soil).tripped;
  return {
    enabled: true,
    gatePass,
    secured: gatePass,
    label: gatePass ? AA_GATEWAY_SECURED_LABEL : AA_GATEWAY_DISABLED_LABEL,
  };
}
