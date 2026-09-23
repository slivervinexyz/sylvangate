#!/usr/bin/env tsx
/** Case B3 — Agent/treasury pre-sign inbound block probe (42161→46630 · zero broadcast). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateAcrossBridgeDirection, AML_INBOUND_TO_ROBINHOOD_BLOCKED } from "../src/adapters/across-ingress-bridge";
import { quoteRChainYieldToArbitrumGm } from "../src/adapters/robinhood/treasury-escort-router";
import {
  ARBITRUM_ONE_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  assertUnidirectionalBridge,
} from "../src/sdk";

const DEFAULT_WALLET = "0xdf4c3Fe9bADCbb2Cf62c4b334aD021a34f88F913" as const;

function persist(payload: Record<string, unknown>): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(process.cwd(), "docs/logging", `robinhood_livefire_inbound_treasury_${stamp}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

async function main(): Promise<void> {
  const wallet = (process.env.WALLET_ARB ?? DEFAULT_WALLET).trim();
  const nowMs = Date.now();
  let rpcBroadcastAttempted = false;

  const direction = validateAcrossBridgeDirection({
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    destChainId: ROBINHOOD_TESTNET_CHAIN_ID,
  });
  const bridge = assertUnidirectionalBridge({
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    destChainId: ROBINHOOD_TESTNET_CHAIN_ID,
    amountUsd: 100,
    wallet,
    initiatedAtMs: nowMs,
    nowMs,
  });
  const treasuryMisuse = quoteRChainYieldToArbitrumGm({
    wallet,
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    assetKind: "rwa",
    symbol: "USDC",
    amountUsd: 100,
    nowMs,
  });

  const pass =
    direction.inboundBlocked === true &&
    direction.reasons.includes(AML_INBOUND_TO_ROBINHOOD_BLOCKED) &&
    bridge.ok === false &&
    bridge.capitalLabel === AML_INBOUND_TO_ROBINHOOD_BLOCKED &&
    bridge.lostUsd === 0 &&
    treasuryMisuse.ok === false &&
    treasuryMisuse.reasons.includes("RWA_YIELD_SOURCE_CHAIN_UNSUPPORTED") &&
    !rpcBroadcastAttempted;

  const logPath = persist({
    case: "B3",
    wallet,
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    destChainId: ROBINHOOD_TESTNET_CHAIN_ID,
    direction,
    bridge,
    treasuryMisuse: {
      ok: treasuryMisuse.ok,
      reasons: treasuryMisuse.reasons,
      bridgeEscortOk: treasuryMisuse.bridgeEscortOk,
    },
    rpcBroadcastAttempted,
    pass,
    at: new Date().toISOString(),
  });

  console.log("[inbound-treasury] pre-sign probe", {
    wallet,
    inboundBlocked: direction.inboundBlocked,
    bridgeLabel: bridge.capitalLabel,
    treasuryOk: treasuryMisuse.ok,
    rpcBroadcastAttempted,
    pass,
    logPath,
  });

  if (!pass) throw new Error("INBOUND_TREASURY_PROBE_FAIL");
}

main().catch((err) => {
  console.error("[inbound-treasury] fail-closed", err);
  process.exit(1);
});
