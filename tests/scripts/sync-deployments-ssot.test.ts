import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  buildDeploymentsMirror,
  gateAddressShort,
  syncDeploymentsToSystemMetricsSsot,
  SYSTEM_METRICS_SSOT_PATH,
} from "../../scripts/_shared/sync-deployments-ssot-lib";
import {
  MAINNET_DEPLOYMENTS,
  SEPOLIA_ONLY_DEPLOYMENTS,
  SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS,
  SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS,
} from "../../src/config/contract-deployments";
import { loadSystemMetricsSsot, resolveSsotGateAddress } from "../../scripts/_shared/sync-ssot-docs-lib";

const ROOT = process.cwd();

describe("sync-deployments-ssot", () => {
  it("buildDeploymentsMirror matches TS SSOT live counts", () => {
    const mirror = buildDeploymentsMirror();
    expect(mirror.ssot_source).toBe("src/config/contract-deployments.ts");
    expect(mirror.chains.arbitrum_one.live).toHaveLength(MAINNET_DEPLOYMENTS.length);
    expect(mirror.chains.arbitrum_sepolia.live).toHaveLength(SEPOLIA_ONLY_DEPLOYMENTS.length);
    expect(mirror.chains.arbitrum_one.gate_address).toBe(SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS);
    expect(mirror.chains.arbitrum_sepolia.gate_address).toBe(SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS);
  });

  it("gateAddressShort truncates checksum address", () => {
    expect(gateAddressShort(SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS)).toBe("0x71d7…e2f1");
  });

  it("syncDeploymentsToSystemMetricsSsot writes deployments block and gate_contracts", () => {
    syncDeploymentsToSystemMetricsSsot(ROOT);
    const raw = JSON.parse(readFileSync(join(ROOT, SYSTEM_METRICS_SSOT_PATH), "utf8"));
    expect(raw.deployments?.chains?.arbitrum_one?.live?.length).toBe(MAINNET_DEPLOYMENTS.length);
    expect(raw.onchain_indexer_pipeline.gate_contract).toBe(SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS);
    expect(raw.onchain_indexer_pipeline.gate_contracts["42161"]).toBe(SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS);
    expect(raw.onchain_indexer_pipeline.gate_contracts["421614"]).toBe(SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS);

    const ssot = loadSystemMetricsSsot(ROOT);
    expect(resolveSsotGateAddress(ssot, 42161)).toBe(SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS);
    expect(resolveSsotGateAddress(ssot, 421614)).toBe(SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS);
  });
});
