/** Demo SSOT — segregated deposit tranches (Pillar 2 Smart Routing). */

export interface DepositSelectOption {
  value: string;
  label: string;
}

export type DepositTrancheId = "tranche-a-native" | "tranche-b-robinhood";

export interface DepositTrancheConfig {
  id: DepositTrancheId;
  label: string;
  subtitle: string;
  sendToken: string;
  sendTokenOptions: readonly DepositSelectOption[];
  sendChain: string;
  sendChainOptions: readonly DepositSelectOption[];
  receiveToken: string;
  receiveTokenOptions: readonly DepositSelectOption[];
  receiveChain: string;
  receiveChainOptions: readonly DepositSelectOption[];
  safetyBadgeLabel: string;
  actionLabel: string;
  depositingLabel: string;
  bridgeStateMachine: readonly string[];
}

export const DEPOSIT_TRANCHE_OPTIONS: readonly {
  id: DepositTrancheId;
  label: string;
  description: string;
}[] = [
  {
    id: "tranche-a-native",
    label: "Tranche A — Arbitrum Native Vault",
    description: "Instant USDC ingress · zero bridge latency · GMX GM + HL hedge",
  },
  {
    id: "tranche-b-robinhood",
    label: "Tranche B — Robinhood Ingress Escort",
    description: "Outbound-only AML firewall · Across bridge state machine · lostUsd ≡ 0",
  },
];

export const DEPOSIT_TRANCHE_A: DepositTrancheConfig = {
  id: "tranche-a-native",
  label: "Tranche A — Arbitrum Native Vault",
  subtitle: "42161 instant path · checkSoilResistance() → GMX GM deposit + HL 1× short",
  sendToken: "USDC",
  sendTokenOptions: [{ value: "USDC", label: "USDC" }],
  sendChain: "arbitrum",
  sendChainOptions: [{ value: "arbitrum", label: "Arbitrum One" }],
  receiveToken: "GM_LP",
  receiveTokenOptions: [{ value: "GM_LP", label: "GM Pool LP" }],
  receiveChain: "arbitrum",
  receiveChainOptions: [{ value: "arbitrum", label: "Arbitrum One" }],
  safetyBadgeLabel:
    "Native Vault · payloadHash bound via GatedExecutor (Zero EIP-712 struct change)",
  actionLabel: "🌊 Deposit to SliverVine ExoMesh Shield Native Vault (Tranche A)",
  depositingLabel: "Binding GM payload…",
  bridgeStateMachine: ["N/A — Arbitrum-native · no IN_FLIGHT bridge state"],
};

export const DEPOSIT_TRANCHE_B: DepositTrancheConfig = {
  id: "tranche-b-robinhood",
  label: "Tranche B — Robinhood Ingress Escort",
  subtitle:
    "4663 → 42161 outbound-only · Elara-aligned AML firewall · bridge state machine",
  sendToken: "USDG",
  sendTokenOptions: [{ value: "USDG", label: "USDG" }],
  sendChain: "rh-4663",
  sendChainOptions: [{ value: "rh-4663", label: "Robinhood Mainnet 4663" }],
  receiveToken: "USDG",
  receiveTokenOptions: [
    { value: "USDG", label: "USDG" },
    { value: "GM_LP", label: "GM Pool LP" },
  ],
  receiveChain: "arbitrum",
  receiveChainOptions: [
    { value: "arbitrum", label: "Arbitrum One" },
    { value: "rh-4663", label: "Robinhood Mainnet 4663" },
  ],
  safetyBadgeLabel:
    "Calldata Hash Bound via payloadHash · AML inbound blocked · ArbOS Elara ingress (V1.0)",
  actionLabel: "🌊 Escort Capital via Robinhood Bridge (Tranche B)",
  depositingLabel: "Escorting Capital…",
  bridgeStateMachine: [
    "AVAILABLE → IN_FLIGHT_BRIDGE_CAPITAL → SETTLED",
    "> 1h timeout → BRIDGE_TIMEOUT_FAIL_CLOSED · lostUsd ≡ 0",
  ],
};

export const DEPOSIT_TRANCHES: Readonly<Record<DepositTrancheId, DepositTrancheConfig>> = {
  "tranche-a-native": DEPOSIT_TRANCHE_A,
  "tranche-b-robinhood": DEPOSIT_TRANCHE_B,
};

export function resolveDepositTrancheConfig(id: DepositTrancheId): DepositTrancheConfig {
  return DEPOSIT_TRANCHES[id];
}
