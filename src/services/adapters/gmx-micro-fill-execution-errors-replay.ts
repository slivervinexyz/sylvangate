/** GMX micro-fill on-chain revert replay via eth_call + diagnostic RPC fallback. */
import type { Hex, PublicClient } from "viem";
import { extractGmxSimulateRevertDetails } from "./gmx-micro-fill-router-encode";
import { diagnoseGmxFailedTransaction, type GmxFailedTxDiagnostics } from "./gmx-micro-fill-rpc-diagnostics";

/** Replay a mined revert via eth_call; falls back to non-Alchemy RPC + call trace when primary is silent. */
export async function decodeGmxFailedTransaction(
  client: Pick<PublicClient, "getTransaction" | "call" | "getTransactionReceipt">,
  txHash: Hex,
  opts?: { primaryRpc?: string; fetchFn?: typeof fetch },
): Promise<GmxFailedTxDiagnostics | undefined> {
  const tx = await client.getTransaction({ hash: txHash });
  if (!tx.to || !tx.input) return undefined;
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const blockTag = `0x${receipt.blockNumber.toString(16)}` as Hex;
  const replayFields = {
    from: tx.from,
    to: tx.to,
    input: tx.input,
    value: tx.value,
    gas: tx.gas,
    blockTag,
  };
  let primaryReplay: GmxFailedTxDiagnostics | undefined;
  try {
    await client.call({
      account: tx.from,
      to: tx.to,
      data: tx.input,
      value: tx.value,
      gas: tx.gas,
      blockNumber: receipt.blockNumber,
    });
  } catch (err) {
    const details = extractGmxSimulateRevertDetails(err);
    if (details.decodedError || (details.rawData && details.rawData !== "0x")) {
      const parts = [details.decodedError, details.rawData ? `rawData=${details.rawData}` : undefined]
        .filter(Boolean);
      primaryReplay = {
        summary: parts.join(" | ") || details.message,
        decodedError: details.decodedError,
        rawData: details.rawData,
        rpcUrl: opts?.primaryRpc,
      };
    }
  }
  return diagnoseGmxFailedTransaction({
    tx: replayFields,
    txHash,
    primaryRpc: opts?.primaryRpc,
    fetchFn: opts?.fetchFn,
    primaryReplay,
  });
}
