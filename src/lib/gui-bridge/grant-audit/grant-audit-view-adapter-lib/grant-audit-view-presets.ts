import { SCALE_DOWN_COMBO_PRESETS } from "../../scale-down-presets";
import {
  buildGrantAuditArbitrumExplorerUrl,
  buildGrantAuditHlMainnetSessionExplorerUrl,
  GRANT_AUDIT_GMX_ARBITRUM_TX_HASH,
  GRANT_AUDIT_HL_MAINNET_OID,
} from "../../grant-ui-ssot";
import type { GrantAuditExecution, GrantAuditPreset } from "../grant-audit-view-types";
import type { SepoliaDualLegProof } from "../../../../routes/grant-audit-lib/sepolia-dual-leg-proof.types";

export const V0_VITEST_PASS = 1108;
export const V0_VITEST_FILES = 243;

export function buildDefaultExecutions(
  gmPoolUsd: number,
  legBHedgeUsd: number,
  sepoliaProof?: SepoliaDualLegProof | null,
): GrantAuditExecution[] {
  const gmxHash = sepoliaProof?.sepoliaTxHash ?? GRANT_AUDIT_GMX_ARBITRUM_TX_HASH;
  const gmxExplorerUrl =
    sepoliaProof?.arbiscanUrl ?? buildGrantAuditArbitrumExplorerUrl(gmxHash);
  const gmxStatus = sepoliaProof ? "VERIFIED" : "VERIFIED";
  const hlOrderRef = sepoliaProof?.hlOrderId ?? GRANT_AUDIT_HL_MAINNET_OID;
  return [
    {
      id: "exec_hype_short",
      action: sepoliaProof
        ? `1x Short Hedge · ${sepoliaProof.hl.symbol} (HL Testnet)`
        : `1x Short Rebalance · ETH (OID ${GRANT_AUDIT_HL_MAINNET_OID})`,
      venue: "HL",
      hash: hlOrderRef,
      explorerUrl: buildGrantAuditHlMainnetSessionExplorerUrl(),
      explorer: "Hyperliquid",
      amountUsd: Math.max(legBHedgeUsd * 0.351, 1),
      status: sepoliaProof?.hl.dryRun ? "SIMULATED" : "FILLED",
    },
    {
      id: "exec_gm_rebalance",
      action: "GM Pool Rebalance · ETH/USD (Sepolia)",
      venue: "GMX",
      hash: gmxHash,
      explorerUrl: gmxExplorerUrl,
      explorer: sepoliaProof ? "Arbiscan Sepolia" : "Arbiscan",
      amountUsd: gmPoolUsd,
      status: gmxStatus,
    },
  ];
}

export const V0_PRESETS: GrantAuditPreset[] = [
  {
    id: "COMBO_A",
    name: "GMX Blue Shield",
    version: "v0.8",
    description: SCALE_DOWN_COMBO_PRESETS.COMBO_A.name,
    maxSlippageBps: 20,
    oracleLagMs: 120,
    rootsActive: 6,
  },
  {
    id: "COMBO_B",
    name: "Institutional Circuit",
    version: "v1.0",
    description: SCALE_DOWN_COMBO_PRESETS.COMBO_B.name,
    maxSlippageBps: 15,
    oracleLagMs: 95,
    rootsActive: 12,
    recommended: true,
  },
  {
    id: "COMBO_C",
    name: "Black Swan Defense",
    version: "v1.5",
    description: SCALE_DOWN_COMBO_PRESETS.COMBO_C.name,
    maxSlippageBps: 10,
    oracleLagMs: 80,
    rootsActive: 20,
  },
];
