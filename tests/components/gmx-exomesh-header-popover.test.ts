import { describe, expect, it } from "vitest";
import {
  GMX_HEADER_MICROSERVICES,
  resolveHlSecondaryLegStatus,
} from "../../src/lib/gui-bridge/grant-audit/gmx-header-microservices";

describe("gmx-header-microservices", () => {
  it("exposes GMX microservice rows for ExoMesh header telemetry", () => {
    expect(GMX_HEADER_MICROSERVICES.length).toBeGreaterThan(0);
    for (const row of GMX_HEADER_MICROSERVICES) {
      expect(row.label.length).toBeGreaterThan(0);
      if (row.id !== "oracle") expect(row.value.length).toBeGreaterThan(0);
    }
    expect(GMX_HEADER_MICROSERVICES.some((r) => r.id === "oracle")).toBe(true);
  });

  it("maps standby HL adapter to STANDBY secondary leg", () => {
    expect(resolveHlSecondaryLegStatus("standby")).toBe("STANDBY");
    expect(resolveHlSecondaryLegStatus("active")).toBe("CONNECTED");
  });
});
