import { describe, expect, it } from "vitest";
import {
  MAINNET_DEPLOYMENTS,
  resolveGateAddressForChain,
  SEPOLIA_ONLY_DEPLOYMENTS,
  SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS,
  SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS,
} from "../../src/config/contract-deployments";
import {
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  GATE_EIP712_DOMAIN_EXOMESH_WIRE,
  resolveGateEip712DomainName,
  SLIVERVINE_GATE_MAINNET_ADDRESS,
  SLIVERVINE_GATE_SEPOLIA_ADDRESS,
} from "../../src/sdk/constants";

describe("contract-deployments SSOT", () => {
  it("ExoMesh Gate on mainnet and sepolia", () => {
    expect(SLIVERVINE_GATE_MAINNET_ADDRESS).toBe(SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS);
    expect(SLIVERVINE_GATE_SEPOLIA_ADDRESS).toBe(SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS);
    expect(resolveGateAddressForChain(ARBITRUM_ONE_CHAIN_ID)).toBe(
      SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS,
    );
    expect(resolveGateAddressForChain(ARBITRUM_SEPOLIA_CHAIN_ID)).toBe(
      SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS,
    );
    expect(resolveGateEip712DomainName(ARBITRUM_ONE_CHAIN_ID)).toBe(GATE_EIP712_DOMAIN_EXOMESH_WIRE);
    expect(resolveGateEip712DomainName(ARBITRUM_SEPOLIA_CHAIN_ID)).toBe(
      GATE_EIP712_DOMAIN_EXOMESH_WIRE,
    );
  });

  it("lists mainnet PolicyGuardV2 with stylus wired", () => {
    const policy = MAINNET_DEPLOYMENTS.find((d) => d.name === "SliverVineAgentPolicyGuardV2");
    expect(policy?.network).toBe("mainnet");
    expect(policy?.chainIds).toEqual([42161]);
    expect(policy?.role).toContain("stylusCoprocessor");
  });

  it("lists sepolia ExoMesh gate + Sanctuary ingress", () => {
    const gate = SEPOLIA_ONLY_DEPLOYMENTS.find((d) => d.name === "SliverVineGate");
    const ingress = SEPOLIA_ONLY_DEPLOYMENTS.find((d) => d.name === "IngressSafetySwitch");
    expect(gate?.address).toBe(SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS);
    expect(gate?.network).toBe("sepolia");
    expect(ingress?.network).toBe("sepolia");
    expect(ingress?.chainIds).toEqual([421614]);
  });
});
