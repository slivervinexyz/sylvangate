/**
 * On-chain deployment SSOT — Arbitrum One (42161) · Arbitrum Sepolia (421614).
 * Docs mirror: docs/01_architecture_and_standards/01_core_specs/03_CONTRACT_DEPLOYMENT_MATRIX.md
 */
export const ARBITRUM_ONE_CHAIN_ID = 42161 as const;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;

export type DeploymentNetwork = "mainnet" | "sepolia" | "dual";

export interface ContractDeployment {
  name: string;
  address: `0x${string}`;
  network: DeploymentNetwork;
  chainIds: readonly number[];
  role: string;
  source?: string;
}

/** Legacy Sanctuary Gate (superseded on mainnet + sepolia). */
export const SLIVERVINE_GATE_DUAL_DEPLOY_ADDRESS =
  "0xb174118bC0B84e8D6D59EEF2339e29bF7FCf8BF1" as const;

/** Mainnet ExoMesh Gate redeploy (42161 · domain `SliverVineExoMesh`). */
export const SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS =
  "0x71D7d26f98110c5DE3df0fCbddCf2A3A2BC6e2f1" as const;

export const SLIVERVINE_GATE_MAINNET_EXOMESH_DOMAIN_SEPARATOR =
  "0xf866d2f8ccb8e567fac3e781b816a26a7fe86fbf15453c23a1594f0987a8233c" as const;

/** Sepolia ExoMesh Gate redeploy (421614 · domain `SliverVineExoMesh`). */
export const SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS =
  "0xc66F96611a737c4e58706D0955594456eAb88959" as const;

export const SLIVERVINE_GATE_SEPOLIA_EXOMESH_DOMAIN_SEPARATOR =
  "0x411948a5917ff9bb6a62735a498edc0e1b9f64f5a7d1366863a72a539aaadae3" as const;

export const MAINNET_IGNITION_TX =
  "0x54c153e9a41f704b5eb0ae554eac593d1110d62bd826ff094e72f2bd60c1b0c6" as const;

/** Engine A — Stylus soil coprocessor (PolicyGuardV2 · wired on ExoMesh redeploy). */
export const STYLUS_SOIL_COPROCESSOR_MAINNET =
  "0xc23587d6573dd134f95b02b0202ffbf84686625e" as const;

export const BOOTSTRAP_IGNITION_SIGNER_A =
  "0x1111111111111111111111111111111111111111" as const;
export const BOOTSTRAP_IGNITION_SIGNER_B =
  "0x2222222222222222222222222222222222222222" as const;

export const MAINNET_DEPLOYMENTS: readonly ContractDeployment[] = [
  {
    name: "SliverVineGate",
    address: SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS,
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "EIP-712 consume-once attestation anchor · ExoMesh domain",
    source: "SliverVineGate/script/DeployArbitrumOneGate.s.sol",
  },
  {
    name: "SliverVineAgentPolicyGuardV2",
    address: "0x5df192f9454fd02a89e768632cb5da0762a774bc",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "ERC-8196 agent policy pre-screen · stylusCoprocessor wired",
    source: "scripts/deploy-policy-guard-v2-mainnet.ts",
  },
  {
    name: "GmxSoilMatrixSwitch",
    address: "0xd840ad013d3be8a363d537a80d5ea8700f7a34c4",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Single-SLOAD defense matrix bitmap",
    source: "scripts/deploy-policy-guard-v2-mainnet.ts",
  },
  {
    name: "SliverVineRiskOracleV2",
    address: "0xc7f577ac7e1270e6e99e1b700301c25e98df2456",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Risk oracle feed for PolicyGuardV2 · ExoMesh domain",
    source: "scripts/deploy-policy-guard-v2-mainnet.ts",
  },
  {
    name: "SliverVineSoilCoprocessor",
    address: STYLUS_SOIL_COPROCESSOR_MAINNET,
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Stylus on-chain soil coprocessor (Engine A · PolicyGuardV2 stylusCoprocessor gate)",
    source: "scripts/deploy-stylus-mainnet.ts",
  },
];

export const SEPOLIA_ONLY_DEPLOYMENTS: readonly ContractDeployment[] = [
  {
    name: "SliverVineGate",
    address: SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS,
    network: "sepolia",
    chainIds: [ARBITRUM_SEPOLIA_CHAIN_ID],
    role: "EIP-712 consume-once attestation anchor · ExoMesh domain",
    source: "scripts/deploy-sepolia-gate.sol",
  },
  {
    name: "SliverVineRiskOracle",
    address: "0x6CA7eA722F139F3C23280ebc973caff3B17d8fEa",
    network: "sepolia",
    chainIds: [ARBITRUM_SEPOLIA_CHAIN_ID],
    role: "EIP-712 offline risk report · STATUS_SHUTDOWN flush · ExoMesh domain",
    source: "scripts/deploy-sepolia-gate.sol",
  },
  {
    name: "IngressSafetySwitch",
    address: "0xc1Eb1624A3A93e969De57466b1CDbD0e0189D192",
    network: "sepolia",
    chainIds: [ARBITRUM_SEPOLIA_CHAIN_ID],
    role: "Pillar Set X compliance filter · async escort ingress",
    source: "scripts/deploy-sepolia-gate.sol",
  },
];

export const SEPOLIA_SUPERSEDED_DEPLOYMENTS: readonly ContractDeployment[] = [
  {
    name: "SliverVineGate (Sanctuary dual-deploy · legacy superseded)",
    address: SLIVERVINE_GATE_DUAL_DEPLOY_ADDRESS,
    network: "sepolia",
    chainIds: [ARBITRUM_SEPOLIA_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy",
  },
  {
    name: "SliverVineRiskOracle v0",
    address: "0x3FFa2539f502682E8145e6Eb427ff78d258D53a4",
    network: "sepolia",
    chainIds: [ARBITRUM_SEPOLIA_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy",
  },
  {
    name: "IngressSafetySwitch v0",
    address: "0x3E4298e2b8d4e30396A54C1817Eb71c9272Ffb4B",
    network: "sepolia",
    chainIds: [ARBITRUM_SEPOLIA_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy",
  },
];

export const MAINNET_SUPERSEDED_DEPLOYMENTS: readonly ContractDeployment[] = [
  {
    name: "SliverVineGate (Sanctuary ignition · legacy superseded)",
    address: SLIVERVINE_GATE_DUAL_DEPLOY_ADDRESS,
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy",
  },
  {
    name: "SliverVineAgentPolicyGuardV2 v0",
    address: "0xfd98cadb7018f692ec58cd4359e0c0399f4f8781",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy (stylusCoprocessor=0)",
  },
  {
    name: "SliverVineGatePolicyLink v0",
    address: "0xe4ef5350963241c49a29e72a4cf093208cd19af0",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Superseded — native setPolicyGuard on new Gate",
  },
  {
    name: "GmxSoilMatrixSwitch v0",
    address: "0x4129aee97e68aa3712c56fe9ec48bf369782f99b",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy",
  },
  {
    name: "SliverVineRiskOracleV2 v0",
    address: "0xfadb14759a3d3c7e976697de61bf62627f14ec93",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Superseded by ExoMesh redeploy",
  },
  {
    name: "SliverVineAgentPolicyGuard v1",
    address: "0xc66f96611a737c4e58706d0955594456eab88959",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Superseded by PolicyGuardV2",
  },
  {
    name: "SliverVineAgentPolicyGuard v0",
    address: "0x3e4298e2b8d4e30396a54c1817eb71c9272ffb4b",
    network: "mainnet",
    chainIds: [ARBITRUM_ONE_CHAIN_ID],
    role: "Legacy bootstrap policy guard",
  },
];

export function resolveGateAddressForChain(chainId: number): `0x${string}` {
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return SLIVERVINE_GATE_SEPOLIA_EXOMESH_ADDRESS;
  }
  if (chainId === ARBITRUM_ONE_CHAIN_ID) {
    return SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS;
  }
  return SLIVERVINE_GATE_MAINNET_EXOMESH_ADDRESS;
}
