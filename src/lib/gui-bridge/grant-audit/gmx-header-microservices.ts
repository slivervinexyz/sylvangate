/** GMX v2 ExoMesh header popover — primary microservice status SSOT. */

export interface GmxHeaderMicroserviceRow {
  id: string;
  label: string;
  value: string;
}

export const GMX_HEADER_MICROSERVICES: readonly GmxHeaderMicroserviceRow[] = [
  { id: "datastore", label: "GMX v2 DataStore", value: "SYNCED" },
  { id: "rebate", label: "Price Impact Rebate", value: "ACTIVE (+0.02%)" },
  { id: "oracle", label: "Chainlink Oracle Lag", value: "<30s (FAIL-CLOSED)" },
] as const;

export const GMX_HEADER_POPOVER_TITLE = "GMX v2 ExoMesh · Primary Gateway" as const;
export const GMX_HEADER_SECONDARY_LEG_LABEL = "Secondary Leg (HL Session)" as const;

export type L2AdapterMode = "standby" | "active" | "degraded";

export function resolveHlSecondaryLegStatus(mode: L2AdapterMode): string {
  if (mode === "standby") return "STANDBY";
  if (mode === "degraded") return "DEGRADED";
  return "CONNECTED";
}

export function microserviceValueClass(value: string): string {
  if (value === "STANDBY" || value === "DEGRADED") {
    return "bg-amber-500/15 text-amber-300";
  }
  return "bg-[#2d42fc]/20 text-[#ffffff]";
}
