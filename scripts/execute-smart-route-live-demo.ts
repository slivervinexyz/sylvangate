#!/usr/bin/env tsx
/**
 * Robinhood ingress → Arbitrum One smart-route ZeroDev Kernel v3 UserOp (PolicyGuard + optional Gate bind).
 * Dry-run default. Live: CONFIRM_SMART_ROUTE_DEMO=YES BROADCAST=1 MAINNET_PK=0x… ZERODEV_PROJECT_ID=…
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk";
import {
  createPublicClient, createWalletClient, encodeFunctionData, http, keccak256, parseAbi, toHex, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import type { SmartAccount } from "viem/account-abstraction";
import { buildZeroDevRpcUrl } from "../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import { buildKernelAccount } from "../src/adapters/arbitrum/zerodev-aa/zerodev-aa-kernel";
import { ARBITRUM_ONE_CHAIN_ID, resolveGateAddressForChain } from "../src/config/contract-deployments";
import { GMX_MARKET_REGISTRY } from "../src/config/gmx-markets";
import { resolveSmartRouteSourceChainId } from "../src/config/gmx-revenue";
import { EIP712_DOMAIN_NAME, EIP712_DOMAIN_VERSION } from "../src/sdk/constants";
import { checkSoilResistanceWithArbFallback } from "../src/services/risk-control";
import { buildGmxSmartRoutePayloadBinding } from "../src/services/adapters/gmx-smart-route-payload-binding";
import { buildGmxV2UnsignedOrderPayload } from "../src/services/adapters/gmx-v2-order-payload";
import { printLiveHarnessBypassBanner } from "./_shared/live-harness-warning";
import { loadMainnetEnv, resolveMainnetPrivateKey } from "./_shared/mainnet-env";
import { requireGateSignerForGmxFill, resolveRegisteredGateSigner } from "./gmx-micro-fill-gate";

const POLICY_GUARD = "0x3e4298e2b8d4e30396a54c1817eb71c9272ffb4b" as Hex;
const GATE = resolveGateAddressForChain(ARBITRUM_ONE_CHAIN_ID) as Hex;
const CHAIN_ID = 42161;
const RPC = process.env.ARB_MAINNET_RPC_URL ?? "https://arb1.arbitrum.io/rpc";
const SOURCE_CHAIN = resolveSmartRouteSourceChainId();
const AGENT_ID = keccak256(toHex(`silvervine:smart-route:${SOURCE_CHAIN}->${CHAIN_ID}`));
const policyAbi = parseAbi(["function validateAgentPolicy(bytes32 agentId, uint256 maxNotional, uint256 ttl) returns (bytes32)"]);
const gateAbi = parseAbi([
  "function isSigner(address) view returns (bool)",
  "function verifyAndConsume((bytes32 payloadHash,address subject,uint8 verdict,uint16 riskBps,uint64 issuedAt,uint64 expiresAt,uint256 nonce) att, bytes[] signatures) returns (bytes32)",
]);

type KernelCall = { to: Hex; value: bigint; data: Hex };

function arbiscan(tx: string): string { return `https://arbiscan.io/tx/${tx}`; }
function armed(): boolean { return process.env.BROADCAST === "1" && process.env.CONFIRM_SMART_ROUTE_DEMO === "YES"; }
function parseSize(argv: string[]): number {
  const raw = argv.find((a, i) => argv[i - 1] === "--size");
  const n = raw ? Number.parseFloat(raw) : 15;
  if (!Number.isFinite(n) || n < 10 || n > 20) throw new Error("size must be $10–$20 USD");
  return n;
}

function persistTier1Log(payload: Record<string, unknown>): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(process.cwd(), "docs/logging", `robinhood_livefire_tier1_${stamp}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

async function signAtt(wallet: ReturnType<typeof createWalletClient>, att: object): Promise<Hex> {
  return wallet.signTypedData({
    account: wallet.account!, domain: { name: EIP712_DOMAIN_NAME, version: EIP712_DOMAIN_VERSION, chainId: CHAIN_ID, verifyingContract: GATE },
    types: { RiskAttestation: [{ name: "payloadHash", type: "bytes32" }, { name: "subject", type: "address" }, { name: "verdict", type: "uint8" }, { name: "riskBps", type: "uint16" }, { name: "issuedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" }, { name: "nonce", type: "uint256" }] },
    primaryType: "RiskAttestation", message: att,
  });
}

async function main(): Promise<void> {
  loadMainnetEnv();
  printLiveHarnessBypassBanner();
  const sizeUsd = parseSize(process.argv.slice(2));
  const client = createPublicClient({ chain: arbitrum, transport: http(RPC) });
  if ((await client.getChainId()) !== CHAIN_ID) throw new Error(`refuse: expected chain ${CHAIN_ID}`);

  if (process.env.BYPASS_SOIL_PROBE === "true") {
    throw new Error("SOIL_BYPASS_FORBIDDEN: BYPASS_SOIL_PROBE is disabled — soil probe is mandatory");
  }
  const soil = await checkSoilResistanceWithArbFallback({
    symbol: "ETH", hlSpot: 3500, hlPerp: 3500, dydxPerp: 3498, depthUsd: 500_000, orderSizeUsd: sizeUsd, accountBalanceUsd: 10_000,
  });
  if (soil.tripped) throw new Error(`SOIL_TRIP: ${soil.reasons.join(",")}`);

  const projectId = process.env.ZERODEV_PROJECT_ID?.trim();
  if (!projectId) throw new Error("ZERODEV_PROJECT_ID required");
  const pk = resolveMainnetPrivateKey();
  const kernel = await buildKernelAccount({ chainId: CHAIN_ID, chain: arbitrum, rpcUrl: RPC, ownerPrivateKey: pk });
  const bytecode = await client.getBytecode({ address: kernel.address });
  const factoryArgs = await kernel.account.getFactoryArgs?.();
  console.log("[smart-route] kernel", {
    address: kernel.address, deployed: Boolean(bytecode && bytecode !== "0x"),
    factory: factoryArgs?.factory ?? null, hasFactoryData: Boolean(factoryArgs?.factoryData),
  });

  const market = GMX_MARKET_REGISTRY["ETH/USDC"];
  const order = buildGmxV2UnsignedOrderPayload({ side: "long", sizeUsd, midPriceUsd: 3_500, marketToken: market.marketToken, maxSlippageBps: 30 });
  const bindNonce = BigInt(Date.now());
  const binding = buildGmxSmartRoutePayloadBinding({
    sourceChainId: SOURCE_CHAIN, executor: GATE, initiator: kernel.address, nonce: bindNonce, orderPayload: order, targetRoute: "GM_ETH_USDC",
  });
  console.log("[smart-route] binding OK", {
    sourceChainId: SOURCE_CHAIN, destChainId: binding.chainId, targetRoute: binding.targetRoute,
    smartRoutingAddress: binding.smartRoutingAddress, payloadHash: binding.payloadHash, soilOk: true,
  });

  if (!armed()) {
    console.log("[smart-route] dry-run — set CONFIRM_SMART_ROUTE_DEMO=YES BROADCAST=1 MAINNET_PK=0x… ZERODEV_PROJECT_ID=…");
    return;
  }

  const block = await client.getBlock();
  const now = block.timestamp;
  const calls: KernelCall[] = [{
    to: POLICY_GUARD, value: 0n,
    data: encodeFunctionData({ abi: policyAbi, functionName: "validateAgentPolicy", args: [AGENT_ID, BigInt(Math.round(sizeUsd * 1e6)), now + 3600n] }),
  }];

  const gateSignerPk = requireGateSignerForGmxFill(await resolveRegisteredGateSigner(client, pk));
  const att = { payloadHash: binding.payloadHash, subject: kernel.address, verdict: 1, riskBps: 1200, issuedAt: now, expiresAt: now + 30n, nonce: bindNonce };
  const gateWallet = createWalletClient({ account: privateKeyToAccount(gateSignerPk), chain: arbitrum, transport: http(RPC) });
  const gateSig = await signAtt(gateWallet, att);
  calls.push({
    to: GATE, value: 0n,
    data: encodeFunctionData({ abi: gateAbi, functionName: "verifyAndConsume", args: [att, [gateSig]] }),
  });

  const callData = await kernel.account.encodeCalls(calls);
  const bundlerRpc = buildZeroDevRpcUrl(projectId, CHAIN_ID);
  const paymaster = createZeroDevPaymasterClient({ chain: arbitrum, transport: http(bundlerRpc) });
  const kernelClient = createKernelAccountClient({
    account: kernel.account as SmartAccount, chain: arbitrum, bundlerTransport: http(bundlerRpc), client,
    paymaster: { getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }) },
  });
  const userOpHash = await kernelClient.sendUserOperation({ callData });
  const receipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  const tx = receipt.receipt.transactionHash;
  const logPath = persistTier1Log({
    case: "A-Tier1",
    sourceChainId: SOURCE_CHAIN,
    destChainId: CHAIN_ID,
    sizeUsd,
    payloadHash: binding.payloadHash,
    targetRoute: binding.targetRoute,
    kernel: kernel.address,
    userOpHash,
    txHash: tx,
    arbiscanUrl: arbiscan(tx),
    success: receipt.success,
    at: new Date().toISOString(),
  });
  console.log("[smart-route] ZeroDev UserOp", { kernel: kernel.address, userOpHash, tx, success: receipt.success, calls: calls.length, url: arbiscan(tx), logPath });
  if (!receipt.success) throw new Error("Smart-route UserOp reverted");
}

main().catch((err) => { console.error("[smart-route] fail-closed", err); process.exit(1); });
