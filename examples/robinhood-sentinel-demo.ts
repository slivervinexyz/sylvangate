#!/usr/bin/env tsx
/** SliverVine SylvanGate for Robinhood Chain — interactive three validation scenarios. */
import {
  SOURCE_AIRLOCK_INBOUND_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  validateAcrossBridgeDirection,
} from "../src/adapters/across-ingress-bridge";
import {
  ZERODEV_ENTRY_POINT_ADDRESS,
  ZERODEV_ENTRY_POINT_VERSION,
  ZERODEV_KERNEL_VERSION,
} from "../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import { quoteRChainYieldToArbitrumGm } from "../src/adapters/robinhood/treasury-escort-router";
import {
  AGENT_DEADMAN_SLIPPAGE_BPS,
  guardAgentUserOp,
} from "../src/core/agent-exomesh-guard";
import { checkAirlockThreshold } from "../src/core/risk-engine-airlock";
import { writeStateOverride } from "../src/core/state-store";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../src/sdk/constants";
import { buildRobinhoodAuditSnapshot } from "../src/sdk/robinhood-audit-snapshot";
import { assertUnidirectionalBridge } from "../src/sdk/unidirectional-bridge";
import {
  BOLD,
  BRIGHT_GREEN,
  CYAN,
  formatBlockedAlert,
  formatCapitalEscort,
  formatHealthy,
  formatPassBadge,
  formatReflexMetric,
  formatSeveredBadge,
  GRAY,
  GREEN,
  installDemoLogInterceptor,
  pressEnterToContinue,
  printAlertBox,
  R,
  RED,
  boxClose,
  boxLine,
  boxOpen,
  boxRule,
} from "./lib/robinhood-demo-terminal";

const WALLET = "0xdf4c3Fe9bADCbb2Cf62c4b334aD021a34f88F913";
const T0 = 1_700_000_000_000;
const LIVEFIRE_MAINNET_TX =
  "0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d";
const LIVEFIRE_MAINNET_USER_OP =
  "0x9ce020ba389e59aee46e1e3520acf2e48f760a3e76ec1f9ddac74c47c0ecbfea";
const LIVEFIRE_MAINNET_EXPLORER =
  "https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d";
const RH_ALLOWED_VENUES = ["uniswap_v4", "pons_launchpad", "usd_vault"] as const;
const RH_TOXIC_VENUE = "unauthorized_hook_dex";

const HEALTHY_AIRLOCK = {
  symbol: "USDG",
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  venueKey: "usd_vault",
  allowedVenues: RH_ALLOWED_VENUES,
  hlSpot: 1,
  hlPerp: 1,
  dydxPerp: 1,
  depthUsd: 200_000,
  at: new Date(T0),
};

function shortHex(h: string): string {
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h;
}
function assertLostUsdZero(lostUsd: number): void {
  if (lostUsd !== 0) {
    console.error(`${RED}INVARIANT BREACH: lostUsd=${lostUsd}${R}`);
    process.exit(1);
  }
}
function logSylvanGateBlocked(): void {
  printAlertBox(formatBlockedAlert("SessionKey permission drift / toxic flow detected"));
}
function logSylvanGateVenueDrift(toxicVenue: string): void {
  printAlertBox(
    formatBlockedAlert(`Venue Drift Detected: '${toxicVenue}' is not in allowedVenues`),
  );
}
function printBanner(): void {
  console.log("");
  boxOpen(CYAN);
  boxLine(` ${CYAN}${BOLD}SliverVine SylvanGate for Robinhood Chain${R}`, CYAN);
  boxLine(` ${GRAY}home chain${R}  ${ROBINHOOD_MAINNET_CHAIN_ID} mainnet / ${ROBINHOOD_TESTNET_CHAIN_ID} testnet`, CYAN);
  boxLine(` ${GRAY}dest${R}        Arbitrum One ${ARBITRUM_ONE_CHAIN_ID} (outbound escort)`, CYAN);
  boxClose(CYAN);
  console.log("");
}
function printExecutiveSummary(): void {
  boxOpen(CYAN);
  boxLine(` ${BOLD}Executive Summary — Validation Scenarios${R}`, CYAN);
  boxRule(CYAN);
  boxLine(` ${GRAY}1${R}  Scenario 1: SylvanGate Pre-Sign Gate (4663)`, CYAN);
  boxLine(` ${GRAY}2${R}  Scenario 2: Permissioned Airlock Gate`, CYAN);
  boxLine(` ${GRAY}3${R}  Scenario 3: SHA-256 Audit Certificate`, CYAN);
  boxRule(CYAN);
  boxLine(` ${formatReflexMetric(0, false)}`, CYAN);
  boxLine(` ${formatCapitalEscort(0)} · ${formatSeveredBadge()}`, CYAN);
  boxLine(` ${GRAY}Interactive recording mode — press Enter between scenarios${R}`, CYAN);
  boxClose(CYAN);
  console.log("");
}
function printFinalSummary(results: boolean[]): void {
  const allPass = results.every(Boolean);
  boxOpen(allPass ? GREEN : RED);
  boxLine(
    ` ${formatPassBadge(allPass ? "ALL SCENARIOS PASS" : "FAIL", allPass)} · Home Chain ${ROBINHOOD_MAINNET_CHAIN_ID}`,
    allPass ? GREEN : RED,
  );
  boxClose(allPass ? GREEN : RED);
  console.log("");
  if (!allPass) process.exit(1);
}

async function runScenario1KernelEscort(): Promise<boolean> {
  const toxic = await guardAgentUserOp({
    intent: {
      maxSlippageBps: 5,
      airlockThresholdBps: 5,
      targetMarket: "USDG",
    },
    airlock: {
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      symbol: "USDG",
      hlSpot: 100,
      hlPerp: 120,
      dydxPerp: 80,
      depthUsd: 1_000,
      at: new Date(T0),
    },
    atMs: T0,
  });
  const toxicBlocked = !toxic.allowed;
  if (toxicBlocked) logSylvanGateBlocked();
  writeStateOverride(null);

  const preSignStart = performance.now();
  const healthy = await guardAgentUserOp({
    intent: {
      maxSlippageBps: AGENT_DEADMAN_SLIPPAGE_BPS,
      airlockThresholdBps: AGENT_DEADMAN_SLIPPAGE_BPS,
      targetMarket: "USDG",
    },
    airlock: HEALTHY_AIRLOCK,
    atMs: T0,
  });
  const preSignUs = Math.round((performance.now() - preSignStart) * 1000);
  const preSignPass = healthy.allowed;

  const escort = assertUnidirectionalBridge({
    sourceChainId: ROBINHOOD_MAINNET_CHAIN_ID,
    destChainId: ARBITRUM_ONE_CHAIN_ID,
    amountUsd: 15,
    wallet: WALLET,
    initiatedAtMs: T0,
    settledAtMs: T0 + 150_000,
    nowMs: T0 + 180_000,
  });
  const quote = quoteRChainYieldToArbitrumGm({
    assetKind: "rwa",
    symbol: "USDG",
    amountUsd: 15,
    wallet: WALLET,
    sourceChainId: ROBINHOOD_MAINNET_CHAIN_ID,
    initiatedAtMs: T0,
    settledAtMs: T0 + 150_000,
    nowMs: T0 + 180_000,
  });
  assertLostUsdZero(escort.lostUsd);
  const pass =
    toxicBlocked &&
    preSignPass &&
    escort.ok &&
    escort.routeAllowed &&
    quote.ok &&
    quote.bridgeEscortOk;
  boxOpen(pass ? GREEN : RED);
  boxLine(` ${BOLD}Scenario 1: SylvanGate Pre-Sign Gate (Home Chain ${ROBINHOOD_MAINNET_CHAIN_ID})${R}`, pass ? GREEN : RED);
  boxRule(pass ? GREEN : RED);
  boxLine(
    ` ${GRAY}preSign${R}     toxic=blocked · ${formatHealthy(preSignPass)} · ${formatReflexMetric(preSignUs)}`,
    pass ? GREEN : RED,
  );
  boxLine(` ${GRAY}Kernel${R}       v${ZERODEV_KERNEL_VERSION} · EntryPoint v${ZERODEV_ENTRY_POINT_VERSION}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}EP${R}           ${shortHex(ZERODEV_ENTRY_POINT_ADDRESS)}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}route${R}        ${ROBINHOOD_MAINNET_CHAIN_ID} → ${ARBITRUM_ONE_CHAIN_ID} · ${escort.capitalLabel}`, pass ? GREEN : RED);
  boxLine(
    ` ${GRAY}mainnet tx${R}   ${shortHex(LIVEFIRE_MAINNET_TX)} ${BRIGHT_GREEN}${BOLD}[On-Chain Mainnet Anchor]${R}`,
    pass ? GREEN : RED,
  );
  boxLine(` ${GRAY}UserOp${R}       ${shortHex(LIVEFIRE_MAINNET_USER_OP)}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}explorer${R}     ${LIVEFIRE_MAINNET_EXPLORER}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}quote${R}        ${quote.gmPoolTarget} · bridgeEscortOk=${quote.bridgeEscortOk}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}escort${R}       ${formatCapitalEscort(escort.lostUsd)} · bridgeDeployed=false`, pass ? GREEN : RED);
  boxLine(` ${formatPassBadge(pass ? "PASS" : "FAIL", pass)}  outbound escort replay`, pass ? GREEN : RED);
  boxClose(pass ? GREEN : RED);
  console.log("");
  return pass;
}

async function runScenario2PermissionedAirlock(): Promise<boolean> {
  const drift = checkAirlockThreshold({
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    symbol: "PONS",
    allowedVenues: [...RH_ALLOWED_VENUES],
    targetVenue: RH_TOXIC_VENUE,
    hlSpot: 1,
    hlPerp: 1,
    dydxPerp: 1,
    depthUsd: 200_000,
    at: new Date(T0),
  });
  const driftBlocked = drift.tripped && drift.reasons.some((r) => r.includes("VENUE_DRIFT_REJECTED"));
  if (driftBlocked) logSylvanGateVenueDrift(RH_TOXIC_VENUE);
  writeStateOverride(null);

  const inbound = validateAcrossBridgeDirection({
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    destChainId: ROBINHOOD_MAINNET_CHAIN_ID,
  });
  const pass =
    driftBlocked &&
    !inbound.ok &&
    inbound.inboundBlocked &&
    inbound.reasons.includes(SOURCE_AIRLOCK_INBOUND_BLOCKED);
  boxOpen(pass ? GREEN : RED);
  boxLine(` ${BOLD}Scenario 2: Permissioned Airlock Gate${R}`, pass ? GREEN : RED);
  boxRule(pass ? GREEN : RED);
  const venueDriftStr = driftBlocked
    ? `${BRIGHT_GREEN}${BOLD}venueDrift=true${R}`
    : `venueDrift=${driftBlocked}`;
  boxLine(` ${GRAY}preSign${R}     ${venueDriftStr}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}route${R}        ${ARBITRUM_ONE_CHAIN_ID} → ${ROBINHOOD_MAINNET_CHAIN_ID}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}verdict${R}      fail-closed · chain-id boundary predicate`, pass ? GREEN : RED);
  boxLine(` ${GRAY}policy code${R}  ${SOURCE_AIRLOCK_INBOUND_BLOCKED}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}note${R}         decision probe · NOT wallet middleware`, pass ? GREEN : RED);
  boxLine(` ${formatPassBadge(pass ? "PASS" : "FAIL", pass)}  inbound blocked`, pass ? GREEN : RED);
  boxClose(pass ? GREEN : RED);
  console.log("");
  return pass;
}

function runScenario3AuditCertificate(): boolean {
  const nowMs = Date.now();
  const snapshot = buildRobinhoodAuditSnapshot({
    robinhoodChainId: ROBINHOOD_MAINNET_CHAIN_ID,
    amountUsd: 100,
    wallet: WALLET,
    initiatedAtMs: nowMs,
    nowMs,
  });
  assertLostUsdZero(snapshot.lostUsd);
  const pass = snapshot.inboundBlocked && snapshot.mainnetFilterActive;
  boxOpen(pass ? GREEN : RED);
  boxLine(` ${BOLD}Scenario 3: SHA-256 Audit Certificate${R}`, pass ? GREEN : RED);
  boxRule(pass ? GREEN : RED);
  boxLine(` ${GRAY}chainId${R}      ${snapshot.robinhoodChainId}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}sha256${R}       ${snapshot.sha256Signature.slice(0, 32)}…`, pass ? GREEN : RED);
  boxLine(` ${GRAY}escort${R}       ${formatCapitalEscort(snapshot.lostUsd)}`, pass ? GREEN : RED);
  boxLine(` ${formatPassBadge(pass ? "PASS" : "FAIL", pass)}  certificate emitted below`, pass ? GREEN : RED);
  boxClose(pass ? GREEN : RED);
  console.log(JSON.stringify(snapshot, null, 2));
  console.log("");
  return pass;
}

async function main(): Promise<void> {
  const restoreLog = installDemoLogInterceptor();
  try {
    printBanner();
    printExecutiveSummary();
    await pressEnterToContinue("Press Enter to execute Scenario 1: SylvanGate Pre-Sign Gate...");
    const s1 = await runScenario1KernelEscort();
    await pressEnterToContinue("Press Enter to execute Scenario 2: Permissioned Airlock Gate...");
    const s2 = await runScenario2PermissionedAirlock();
    await pressEnterToContinue("Press Enter to execute Scenario 3: SHA-256 Audit Certificate...");
    const s3 = runScenario3AuditCertificate();
    printFinalSummary([s1, s2, s3]);
  } finally {
    restoreLog();
  }
}

main();
