#!/usr/bin/env tsx
/** SliverVine Kernel Escort for Robinhood Chain — single-run three hero paths. */
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
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
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../src/sdk/constants";
import { buildRobinhoodAuditSnapshot } from "../src/sdk/robinhood-audit-snapshot";
import { assertUnidirectionalBridge } from "../src/sdk/unidirectional-bridge";

const R = "\x1b[0m";
const RED = "\x1b[31;1m";
const GREEN = "\x1b[32;1m";
const CYAN = "\x1b[36;1m";
const GRAY = "\x1b[90m";
const BOLD = "\x1b[1m";
const BOX_W = 72;
const WALLET = "0xdf4c3Fe9bADCbb2Cf62c4b334aD021a34f88F913";
const T0 = 1_700_000_000_000;
const LIVEFIRE_MAINNET_TX =
  "0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d";
const LIVEFIRE_MAINNET_USER_OP =
  "0x9ce020ba389e59aee46e1e3520acf2e48f760a3e76ec1f9ddac74c47c0ecbfea";
const LIVEFIRE_MAINNET_EXPLORER =
  "https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d";

function shortHex(h: string): string {
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h;
}
function stripAnsi(t: string): string {
  return t.replace(/\x1b\[[0-9;]*m/g, "");
}
function boxOpen(c: string): void {
  console.log(`${c}┌${"─".repeat(BOX_W - 2)}┐${R}`);
}
function boxClose(c: string): void {
  console.log(`${c}└${"─".repeat(BOX_W - 2)}┘${R}`);
}
function boxRule(c: string): void {
  console.log(`${c}├${"─".repeat(BOX_W - 2)}┤${R}`);
}
function boxLine(inner: string, c: string): void {
  const pad = Math.max(0, BOX_W - 2 - stripAnsi(inner).length);
  console.log(`${c}│${R}${inner}${" ".repeat(pad)}${c}│${R}`);
}
function assertLostUsdZero(lostUsd: number): void {
  if (lostUsd !== 0) {
    console.error(`${RED}INVARIANT BREACH: lostUsd=${lostUsd}${R}`);
    process.exit(1);
  }
}
function printBanner(): void {
  console.log("");
  boxOpen(CYAN);
  boxLine(` ${CYAN}${BOLD}SliverVine Kernel Escort for Robinhood Chain${R}`, CYAN);
  boxLine(` ${GRAY}home chain${R}  ${ROBINHOOD_MAINNET_CHAIN_ID} mainnet / ${ROBINHOOD_TESTNET_CHAIN_ID} testnet`, CYAN);
  boxLine(` ${GRAY}dest${R}        Arbitrum One ${ARBITRUM_ONE_CHAIN_ID} (outbound escort)`, CYAN);
  boxClose(CYAN);
  console.log("");
}

function runHero1KernelEscort(): boolean {
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
  const pass = escort.ok && escort.routeAllowed && quote.ok && quote.bridgeEscortOk;
  boxOpen(pass ? GREEN : RED);
  boxLine(` ${BOLD}Hero 1 · Kernel Escort (Home Chain ${ROBINHOOD_MAINNET_CHAIN_ID})${R}`, pass ? GREEN : RED);
  boxRule(pass ? GREEN : RED);
  boxLine(` ${GRAY}Kernel${R}       v${ZERODEV_KERNEL_VERSION} · EntryPoint v${ZERODEV_ENTRY_POINT_VERSION}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}EP${R}           ${shortHex(ZERODEV_ENTRY_POINT_ADDRESS)}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}route${R}        ${ROBINHOOD_MAINNET_CHAIN_ID} → ${ARBITRUM_ONE_CHAIN_ID} · ${escort.capitalLabel}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}archived tx${R}  ${shortHex(LIVEFIRE_MAINNET_TX)} ${GRAY}(NOT this CLI)${R}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}UserOp${R}       ${shortHex(LIVEFIRE_MAINNET_USER_OP)}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}explorer${R}     ${LIVEFIRE_MAINNET_EXPLORER}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}quote${R}        ${quote.gmPoolTarget} · bridgeEscortOk=${quote.bridgeEscortOk}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}lostUsd${R}      ${escort.lostUsd} · bridgeDeployed=false`, pass ? GREEN : RED);
  boxLine(` ${pass ? GREEN : RED}${BOLD}${pass ? "PASS" : "FAIL"}${R}  outbound escort replay`, pass ? GREEN : RED);
  boxClose(pass ? GREEN : RED);
  console.log("");
  return pass;
}

function runHero2PermissionedAirlock(): boolean {
  const inbound = validateAcrossBridgeDirection({
    sourceChainId: ARBITRUM_ONE_CHAIN_ID,
    destChainId: ROBINHOOD_MAINNET_CHAIN_ID,
  });
  const pass =
    !inbound.ok &&
    inbound.inboundBlocked &&
    inbound.reasons.includes(AML_INBOUND_TO_ROBINHOOD_BLOCKED);
  boxOpen(pass ? GREEN : RED);
  boxLine(` ${BOLD}Hero 2 · Permissioned Airlock Gate${R}`, pass ? GREEN : RED);
  boxRule(pass ? GREEN : RED);
  boxLine(` ${GRAY}route${R}        ${ARBITRUM_ONE_CHAIN_ID} → ${ROBINHOOD_MAINNET_CHAIN_ID}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}verdict${R}      fail-closed · chain-id boundary predicate`, pass ? GREEN : RED);
  boxLine(` ${GRAY}policy code${R}  ${AML_INBOUND_TO_ROBINHOOD_BLOCKED}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}note${R}         decision probe · NOT wallet middleware`, pass ? GREEN : RED);
  boxLine(` ${pass ? GREEN : RED}${BOLD}${pass ? "PASS" : "FAIL"}${R}  inbound blocked`, pass ? GREEN : RED);
  boxClose(pass ? GREEN : RED);
  console.log("");
  return pass;
}

function runHero3AuditCertificate(): boolean {
  const snapshot = buildRobinhoodAuditSnapshot({
    robinhoodChainId: ROBINHOOD_MAINNET_CHAIN_ID,
    amountUsd: 100,
    wallet: WALLET,
    initiatedAtMs: T0,
    nowMs: T0,
  });
  assertLostUsdZero(snapshot.lostUsd);
  const pass = snapshot.inboundBlocked && snapshot.mainnetFilterActive;
  boxOpen(pass ? GREEN : RED);
  boxLine(` ${BOLD}Hero 3 · SHA-256 Audit Certificate${R}`, pass ? GREEN : RED);
  boxRule(pass ? GREEN : RED);
  boxLine(` ${GRAY}chainId${R}      ${snapshot.robinhoodChainId}`, pass ? GREEN : RED);
  boxLine(` ${GRAY}sha256${R}       ${snapshot.sha256Signature.slice(0, 32)}…`, pass ? GREEN : RED);
  boxLine(` ${pass ? GREEN : RED}${BOLD}${pass ? "PASS" : "FAIL"}${R}  certificate emitted below`, pass ? GREEN : RED);
  boxClose(pass ? GREEN : RED);
  console.log(JSON.stringify(snapshot, null, 2));
  console.log("");
  return pass;
}

function main(): void {
  printBanner();
  const results = [runHero1KernelEscort(), runHero2PermissionedAirlock(), runHero3AuditCertificate()];
  const allPass = results.every(Boolean);
  boxOpen(allPass ? GREEN : RED);
  boxLine(
    ` ${allPass ? GREEN : RED}${BOLD}${allPass ? "ALL PATHS PASS" : "FAIL"}${R} · Home Chain ${ROBINHOOD_MAINNET_CHAIN_ID}`,
    allPass ? GREEN : RED,
  );
  boxClose(allPass ? GREEN : RED);
  console.log("");
  if (!allPass) process.exit(1);
}

main();
