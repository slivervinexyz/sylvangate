import { describe, expect, it } from "vitest";
import {
  buildZeroDevAaMetrics,
  detectPrivateKeyMaterial,
  resolveBundlerStatus,
} from "../../scripts/zerodev-smoke-lib";
import { ARBITRUM_ONE_CHAIN_ID } from "../../scripts/audit-artifact-bindings";
import type { ZeroDevSmokeReport } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-types";

const AT = new Date("2026-08-13T08:40:00.000Z");

describe("zerodev-smoke audit artifact", () => {
  it("builds disabled dry-run metrics with isolation verified", () => {
    const report: ZeroDevSmokeReport = {
      enabled: false,
      configPresent: false,
      errors: [],
      sponsored: true,
      paymasterAttached: false,
    };
    const artifact = buildZeroDevAaMetrics(report, false, null, AT);
    expect(artifact.timestamp).toBe(AT.toISOString());
    expect(artifact.chainId).toBe(ARBITRUM_ONE_CHAIN_ID);
    expect(artifact.gitCommitHash).toBeTruthy();
    expect(artifact.featureFlag).toBe(false);
    expect(artifact.projectId).toBeNull();
    expect(artifact.kernelAddress).toBeNull();
    expect(artifact.bundlerStatus).toBe("DISABLED");
    expect(artifact.noPrivateKeyMaterialDetected).toBe(true);
    expect(artifact.isolationVerified).toBe(true);
  });

  it("builds enabled dry-run metrics without kernel address", () => {
    const report: ZeroDevSmokeReport = {
      enabled: true,
      configPresent: true,
      errors: [],
      sponsored: true,
      paymasterAttached: true,
    };
    const artifact = buildZeroDevAaMetrics(
      report,
      false,
      { projectId: "e93db466-d580-4e15-9cc1-ce50f1541ca2", bundlerRpc: "https://rpc.zerodev.app", chainId: 421614 },
      AT,
    );
    expect(artifact.featureFlag).toBe(true);
    expect(artifact.projectId).toBe("e93db466-d580-4e15-9cc1-ce50f1541ca2");
    expect(artifact.bundlerStatus).toBe("DRY_RUN");
    expect(artifact.kernelAddress).toBeNull();
    expect(artifact.noPrivateKeyMaterialDetected).toBe(true);
    expect(artifact.isolationVerified).toBe(true);
  });

  it("builds live reachable metrics with kernel address", () => {
    const report: ZeroDevSmokeReport = {
      enabled: true,
      configPresent: true,
      bundlerReachable: true,
      smartAccountAddress: "0xE988eD280D24204Bdcf24A5d85ad154f8817e042",
      errors: [],
      sponsored: true,
      paymasterAttached: true,
    };
    const artifact = buildZeroDevAaMetrics(
      report,
      true,
      { projectId: "e93db466-d580-4e15-9cc1-ce50f1541ca2", bundlerRpc: "https://rpc.zerodev.app", chainId: 421614 },
      AT,
    );
    expect(artifact.bundlerStatus).toBe("REACHABLE");
    expect(artifact.kernelAddress).toBe("0xE988eD280D24204Bdcf24A5d85ad154f8817e042");
    expect(resolveBundlerStatus(report, true)).toBe("REACHABLE");
    expect(detectPrivateKeyMaterial(artifact)).toBe(false);
    expect(artifact.noPrivateKeyMaterialDetected).toBe(true);
  });
});
