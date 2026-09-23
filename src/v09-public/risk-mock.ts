/** Public v0.9 risk mock — discrete enums only (no BME formula exposure). */

export enum RiskLevel {
  LOW = "LOW",
  ELEVATED = "ELEVATED",
  HIGH = "HIGH",
}

export type PublicRiskScenario = "nominal" | "gas_spike" | "liquidity_collapse" | "preemptive_evac";

export interface PublicRiskVerdict {
  level: RiskLevel;
  statusCode: 0 | 1 | 3;
  newPositionsFrozen: boolean;
  healthChecksActive: boolean;
  evacuationTriggered: boolean;
  circuitBreakerTripped: boolean;
}

const SCENARIO_TABLE: Record<PublicRiskScenario, PublicRiskVerdict> = {
  nominal: {
    level: RiskLevel.LOW,
    statusCode: 0,
    newPositionsFrozen: false,
    healthChecksActive: true,
    evacuationTriggered: false,
    circuitBreakerTripped: false,
  },
  gas_spike: {
    level: RiskLevel.ELEVATED,
    statusCode: 1,
    newPositionsFrozen: false,
    healthChecksActive: true,
    evacuationTriggered: false,
    circuitBreakerTripped: false,
  },
  liquidity_collapse: {
    level: RiskLevel.HIGH,
    statusCode: 3,
    newPositionsFrozen: true,
    healthChecksActive: true,
    evacuationTriggered: true,
    circuitBreakerTripped: true,
  },
  preemptive_evac: {
    level: RiskLevel.HIGH,
    statusCode: 3,
    newPositionsFrozen: false,
    healthChecksActive: true,
    evacuationTriggered: true,
    circuitBreakerTripped: true,
  },
};

export function evaluatePublicRiskMock(scenario: PublicRiskScenario): PublicRiskVerdict {
  return { ...SCENARIO_TABLE[scenario] };
}
