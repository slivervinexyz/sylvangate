/** 5-core venue Wallet×Token execution matrix — SSOT for CLI preflight + live scripts. */
import { GMX_UI_FEE_RECEIVER } from "../config/gmx-revenue";
import {
  GMX_USDC_ARBITRUM,
  HL_WALLET_A_DEFAULT,
  USDC_DECIMALS,
} from "../config/venue-execution-constants";

export const VENUE_MIN_ETH_GAS = 0.001 as const;
export const VENUE_USDAI_ARBITRUM = "0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef" as const;
export const VENUE_WALLET_B_PRINCIPAL = "0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F" as const;
export const VENUE_WALLET_A_DEFAULT = HL_WALLET_A_DEFAULT;

export type CoreVenueId = "gmx" | "pendle" | "usdai" | "hyperliquid" | "variational";

export type VenueProbeKind = "erc20_gas" | "hl_margin" | "intent_only";

export interface VenueTokenRequirement {
  symbol: string;
  address?: `0x${string}`;
  decimals?: number;
  minUsdDefault: number;
}

export interface VenueMatrixRow {
  id: string;
  venue: CoreVenueId;
  action: string;
  walletRole: "A" | "B";
  walletAddress: `0x${string}`;
  chain: "42161" | "hyperliquid" | "offchain";
  probeKind: VenueProbeKind;
  primaryToken: VenueTokenRequirement;
  gasEthMin: number;
  liveScript?: string;
  demoCommand?: string;
  ssotRef: string;
  notes?: string;
}

const ROWS: readonly VenueMatrixRow[] = [
  {
    id: "gmx-perp",
    venue: "gmx",
    action: "perp-micro-fill",
    walletRole: "A",
    walletAddress: VENUE_WALLET_A_DEFAULT,
    chain: "42161",
    probeKind: "erc20_gas",
    primaryToken: { symbol: "USDC", address: GMX_USDC_ARBITRUM, decimals: USDC_DECIMALS, minUsdDefault: 1 },
    gasEthMin: VENUE_MIN_ETH_GAS,
    liveScript: "execute:gmx:micro-fill",
    demoCommand: "demo:gmx",
    ssotRef: "venue-execution-matrix#gmx-perp",
    notes: "Wallet B perp forbidden",
  },
  {
    id: "gmx-short",
    venue: "gmx",
    action: "perp-short-fallback",
    walletRole: "A",
    walletAddress: VENUE_WALLET_A_DEFAULT,
    chain: "42161",
    probeKind: "erc20_gas",
    primaryToken: { symbol: "USDC", address: GMX_USDC_ARBITRUM, decimals: USDC_DECIMALS, minUsdDefault: 10 },
    gasEthMin: VENUE_MIN_ETH_GAS,
    liveScript: "execute:gmx:wallet-a-short-fallback",
    ssotRef: "venue-execution-matrix#gmx-short",
  },
  {
    id: "gmx-gm-deposit",
    venue: "gmx",
    action: "gm-deposit",
    walletRole: "B",
    walletAddress: VENUE_WALLET_B_PRINCIPAL,
    chain: "42161",
    probeKind: "erc20_gas",
    primaryToken: { symbol: "USDC", address: GMX_USDC_ARBITRUM, decimals: USDC_DECIMALS, minUsdDefault: 10 },
    gasEthMin: VENUE_MIN_ETH_GAS,
    liveScript: "execute:gmx:gm-deposit",
    ssotRef: "venue-execution-matrix#gmx-gm-deposit",
  },
  {
    id: "gmx-gm-withdraw",
    venue: "gmx",
    action: "gm-withdraw",
    walletRole: "B",
    walletAddress: VENUE_WALLET_B_PRINCIPAL,
    chain: "42161",
    probeKind: "erc20_gas",
    primaryToken: { symbol: "USDC", address: GMX_USDC_ARBITRUM, decimals: USDC_DECIMALS, minUsdDefault: 0 },
    gasEthMin: VENUE_MIN_ETH_GAS,
    liveScript: "execute:gmx:gm-withdraw",
    ssotRef: "venue-execution-matrix#gmx-gm-withdraw",
    notes: "Requires GM LP balance; USDC only for gas",
  },
  {
    id: "pendle-pt-dust",
    venue: "pendle",
    action: "pt-dust",
    walletRole: "A",
    walletAddress: VENUE_WALLET_A_DEFAULT,
    chain: "42161",
    probeKind: "erc20_gas",
    primaryToken: {
      symbol: "USDai",
      address: VENUE_USDAI_ARBITRUM,
      decimals: 18,
      minUsdDefault: 1,
    },
    gasEthMin: VENUE_MIN_ETH_GAS,
    liveScript: "execute:pendle:dust",
    demoCommand: "demo:pendle",
    ssotRef: "venue-execution-matrix#pendle-pt-dust",
    notes: "Pendle Fixed Yield does not accept USDC on Arbitrum; exit: execute:pendle:dust-exit (redeem→sUSDai); live harness ≠ on-chain soil — demo:pendle --trip",
  },
  {
    id: "hyperliquid-hedge",
    venue: "hyperliquid",
    action: "perp-hedge",
    walletRole: "A",
    walletAddress: VENUE_WALLET_A_DEFAULT,
    chain: "hyperliquid",
    probeKind: "hl_margin",
    primaryToken: { symbol: "USDC", minUsdDefault: 1 },
    gasEthMin: 0,
    demoCommand: "demo:hl",
    liveScript: "execute:hl:micro-hedge",
    ssotRef: "venue-execution-matrix#hyperliquid-hedge",
  },
  {
    id: "usdai-collateral",
    venue: "usdai",
    action: "collateral-guard",
    walletRole: "A",
    walletAddress: VENUE_WALLET_A_DEFAULT,
    chain: "42161",
    probeKind: "erc20_gas",
    primaryToken: { symbol: "USDai", address: VENUE_USDAI_ARBITRUM, decimals: 18, minUsdDefault: 0 },
    gasEthMin: VENUE_MIN_ETH_GAS,
    demoCommand: "demo:usdai",
    liveScript: "execute:usdai:collateral-probe",
    ssotRef: "venue-execution-matrix#usdai-collateral",
  },
  {
    id: "variational-rfq",
    venue: "variational",
    action: "rfq-intent",
    walletRole: "A",
    walletAddress: VENUE_WALLET_A_DEFAULT,
    chain: "offchain",
    probeKind: "intent_only",
    primaryToken: { symbol: "USDC", minUsdDefault: 1 },
    gasEthMin: 0,
    demoCommand: "demo:variational",
    ssotRef: "venue-execution-matrix#variational-rfq",
  },
];

export const VENUE_TREASURY_ADDRESS = GMX_UI_FEE_RECEIVER;

export function getVenueMatrixRows(): readonly VenueMatrixRow[] {
  return ROWS;
}

export function getVenueRequirement(id: string): VenueMatrixRow | null {
  return ROWS.find((r) => r.id === id) ?? null;
}

export function getVenueRowsByVenue(venue: CoreVenueId): VenueMatrixRow[] {
  return ROWS.filter((r) => r.venue === venue);
}

export function formatVenueMatrixJson(): string {
  return JSON.stringify({ treasury: VENUE_TREASURY_ADDRESS, rows: ROWS }, null, 2);
}
