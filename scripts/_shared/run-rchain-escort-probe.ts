import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, type Chain, type Hex } from "viem";
import { probeBundler } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-bundler";
import { buildRChainYieldEscortProbe } from "../../src/adapters/robinhood/treasury-escort-router";
import { ARBITRUM_ONE_CHAIN_ID } from "../../src/sdk/constants";
import { printLiveHarnessBypassBanner } from "./live-harness-warning";
import { encodeEscortAttestationCalldata, persistRchainLivefireLog } from "./rchain-escort-attestation";
import { broadcastRchainAlchemySponsorEscortProbe } from "./rchain-alchemy-sponsor-broadcast";
import { broadcastRchainEoaEscortProbe } from "./rchain-eoa-broadcast";
import { broadcastRchainZeroDevEscortProbe } from "./rchain-zerodev-broadcast";
import { buildRchainExplorerUrl, buildRobinhoodChain, type RchainProbeTarget } from "./rchain-probe-chain";
import {
  armedRchainProbe,
  assertRchainBroadcastReady,
  dryRunHint,
  loadRchainProbeEnv,
  maskHex,
  resolveAlchemyGasPolicyId,
  resolveEscortAmountUsd,
  resolveProbeMode,
  resolveRchainBroadcastMode,
  resolveRchainZeroDevBundlerRpc,
  resolveRchainZeroDevProjectId,
  resolveRobinhoodProbePrivateKey,
  resolveRobinhoodProbeRpc,
  type RchainBroadcastMode,
} from "./rchain-probe-env";

async function broadcastRchainEscortProbe(params: {
  broadcastMode: RchainBroadcastMode;
  chain: Chain;
  rpcUrl: string;
  bundlerRpc: string;
  policyId: string | null;
  ownerPrivateKey: Hex;
  attestationData: Hex;
}) {
  if (params.broadcastMode === "sponsored") {
    if (!params.policyId) throw new Error("ALCHEMY_GAS_POLICY_ID required for sponsored broadcast");
    return broadcastRchainAlchemySponsorEscortProbe({
      chain: params.chain,
      rpcUrl: params.rpcUrl,
      policyId: params.policyId,
      ownerPrivateKey: params.ownerPrivateKey,
      attestationData: params.attestationData,
    });
  }
  if (params.broadcastMode === "zerodev") {
    return broadcastRchainZeroDevEscortProbe({
      chain: params.chain,
      rpcUrl: params.rpcUrl,
      bundlerRpc: params.bundlerRpc,
      ownerPrivateKey: params.ownerPrivateKey,
      attestationData: params.attestationData,
    });
  }
  return broadcastRchainEoaEscortProbe({
    chain: params.chain,
    rpcUrl: params.rpcUrl,
    ownerPrivateKey: params.ownerPrivateKey,
    attestationData: params.attestationData,
  });
}

export async function runRchainEscortProbe(target: RchainProbeTarget, argv: string[]): Promise<void> {
  loadRchainProbeEnv();
  printLiveHarnessBypassBanner();
  const amountUsd = resolveEscortAmountUsd(argv);
  const symbol = (process.env.RCHAIN_ESCORT_SYMBOL ?? "USDG").trim() || "USDG";
  const nowMs = Date.now();
  const walletHint = (process.env.WALLET_RH ?? "").trim();
  const armed = armedRchainProbe(target);
  const pk = armed ? resolveRobinhoodProbePrivateKey(target) : null;
  const wallet = walletHint || (pk ? privateKeyToAccount(pk).address : "0x0000000000000000000000000000000000000001");

  const { quote, probe } = await buildRChainYieldEscortProbe({
    assetKind: "rwa",
    symbol,
    amountUsd,
    wallet,
    sourceChainId: target.chainId,
    initiatedAtMs: nowMs - 2_000,
    settledAtMs: nowMs - 500,
    nowMs,
  });
  if (!quote.ok || !quote.bridgeEscortOk) {
    throw new Error(`escort quote fail-closed: ${quote.reasons.join(",") || "bridgeEscortOk=false"}`);
  }

  const attestationData = encodeEscortAttestationCalldata({
    routeId: probe.routeId as Hex,
    destChainId: quote.destChainId,
    digestStub: probe.digestStub as Hex,
  });
  const policyId = resolveAlchemyGasPolicyId();
  const zeroDevProjectId = resolveRchainZeroDevProjectId();
  const zeroDevBundlerRpc = resolveRchainZeroDevBundlerRpc(target);
  const rpcHint = (process.env[target.rpcEnvKey] ?? "").trim();
  const alchemyBundlerProbe = rpcHint ? await probeBundler(rpcHint) : null;
  const zeroDevBundlerProbe = await probeBundler(zeroDevBundlerRpc);
  const mode = resolveProbeMode();
  const broadcastMode = resolveRchainBroadcastMode({
    mode,
    policyId,
    zeroDevProjectId,
    alchemyBundlerOk: Boolean(alchemyBundlerProbe?.reachable && alchemyBundlerProbe.supportsEntryPoint07),
    zeroDevBundlerOk: zeroDevBundlerProbe.reachable && zeroDevBundlerProbe.supportsEntryPoint07,
    rpcEnvKey: target.rpcEnvKey,
  });

  console.log("[rchain-probe] preflight OK", {
    sourceChainId: quote.sourceChainId,
    destChainId: quote.destChainId,
    routeId: quote.routeId,
    digestStub: probe.digestStub,
    bridgeEscortOk: quote.bridgeEscortOk,
    stubOnly: probe.stubOnly,
    bridgeDeployed: probe.bridgeDeployed,
    zeroDevProjectId: zeroDevProjectId ? maskHex(zeroDevProjectId) : null,
    zeroDevBundlerRpc,
    alchemyBundlerReachable: alchemyBundlerProbe?.reachable ?? false,
    alchemyBundlerEp07: alchemyBundlerProbe?.supportsEntryPoint07 ?? false,
    zeroDevBundlerReachable: zeroDevBundlerProbe.reachable,
    zeroDevBundlerEp07: zeroDevBundlerProbe.supportsEntryPoint07,
    gasPolicyId: policyId ? maskHex(policyId) : null,
    broadcastMode,
    attestationBytes: attestationData.length,
    wallet: maskHex(wallet),
  });

  if (!armed) {
    console.log(dryRunHint(target));
    return;
  }

  assertRchainBroadcastReady({
    chainId: target.chainId,
    broadcastMode,
    zeroDevBundlerOk: zeroDevBundlerProbe.reachable && zeroDevBundlerProbe.supportsEntryPoint07,
    alchemyBundlerOk: Boolean(alchemyBundlerProbe?.reachable && alchemyBundlerProbe.supportsEntryPoint07),
    policyId,
    rpcEnvKey: target.rpcEnvKey,
  });

  const rpcUrl = resolveRobinhoodProbeRpc(target);
  const chain = buildRobinhoodChain(target, rpcUrl);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  if ((await client.getChainId()) !== target.chainId) {
    throw new Error(`refuse: expected chain ${target.chainId}`);
  }
  const ownerPk = pk ?? resolveRobinhoodProbePrivateKey(target);
  const broadcast = await broadcastRchainEscortProbe({
    broadcastMode,
    chain,
    rpcUrl,
    bundlerRpc: zeroDevBundlerRpc,
    policyId,
    ownerPrivateKey: ownerPk,
    attestationData,
  });

  const { txHash } = broadcast;
  const explorerUrl = buildRchainExplorerUrl(target, txHash);
  const logPath = persistRchainLivefireLog({
    case: "A-Tier2",
    chainId: target.chainId,
    destChainId: ARBITRUM_ONE_CHAIN_ID,
    amountUsd,
    symbol,
    routeId: quote.routeId,
    digestStub: probe.digestStub,
    broadcastMode,
    txHash,
    explorerUrl,
    bundlerRpc: broadcastMode === "zerodev" ? zeroDevBundlerRpc : rpcUrl,
    zeroDevProjectId,
    gasPolicyId: policyId,
    quote,
    at: new Date().toISOString(),
    ...broadcast,
  });

  console.log("[rchain-probe] broadcast OK", {
    chainId: target.chainId,
    broadcastMode,
    txHash,
    explorerUrl: explorerUrl ?? `(set ${target.explorerEnvKey})`,
    logPath,
  });
}
