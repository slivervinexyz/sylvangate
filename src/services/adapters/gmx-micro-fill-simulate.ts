/** GMX micro-fill ExchangeRouter eth_call preflight. */
import type { Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { gmxRouterAbi } from "./gmx-market-increase-multicall";
import { GMX_COLLATERAL_SPENDER_ARBITRUM, GMX_USDC_ARBITRUM, MICRO_FILL_ETH_USDC_MARKET } from "./gmx-micro-fill-constants";
import { normalizeMicroFillMarketToken, verifyMicroFillMarketAgainstGmxApi } from "./gmx-micro-fill-market";
import { buildGmxRouterMulticall } from "./gmx-micro-fill-multicall";
import { extractGmxSimulateRevertDetails, isSilentGmxSimulateRevert } from "./gmx-micro-fill-revert-decode";
import type { GmxMicroFillSimulateClient } from "./gmx-micro-fill-types";

function serializeSimulateError(err: unknown, depth = 0): unknown {
  if (err == null || depth > 5) return err;
  if (typeof err !== "object") return err;
  const o = err as Record<string, unknown>;
  return {
    name: o.name,
    message: o.message,
    shortMessage: o.shortMessage,
    data: o.data,
    raw: o.raw,
    reason: o.reason,
    signature: o.signature,
    cause: serializeSimulateError(o.cause, depth + 1),
  };
}

export function logGmxSimulateRevert(err: unknown, ctx?: Record<string, unknown>): string {
  const details = extractGmxSimulateRevertDetails(err);
  const top = err && typeof err === "object" ? (err as Record<string, unknown>) : undefined;
  const errData = top?.data;
  const causeObj = top?.cause;
  const causeData = causeObj && typeof causeObj === "object" ? (causeObj as Record<string, unknown>).data : undefined;
  const selector = details.rawData?.slice(0, 10) ?? details.causeData?.slice(0, 10);
  console.error("[gmx-micro-fill] simulateContract err.data", errData);
  console.error("[gmx-micro-fill] simulateContract err.cause?.data", causeData);
  console.error("[gmx-micro-fill] simulateContract err json", JSON.stringify(serializeSimulateError(err), null, 2));
  if (selector) console.error("[gmx-micro-fill] simulateContract error selector", selector);
  console.error("[gmx-micro-fill] simulateContract revert details", { ...ctx, ...details, errData, causeData, selector });
  return details.message;
}

export async function simulateGmxMicroFillOrder(input: {
  client: GmxMicroFillSimulateClient;
  payload: GmxV2UnsignedOrderPayload;
  from: Hex;
}): Promise<void> {
  const router = buildGmxRouterMulticall(input.payload);
  const market = normalizeMicroFillMarketToken(input.payload.addresses.market);
  await verifyMicroFillMarketAgainstGmxApi(market);
  console.log("[gmx-micro-fill] market verified", {
    market,
    ethUsdc: MICRO_FILL_ETH_USDC_MARKET,
    collateral: GMX_USDC_ARBITRUM,
  });
  try {
    await input.client.simulateContract({
      address: GMX_COLLATERAL_SPENDER_ARBITRUM,
      abi: gmxRouterAbi,
      functionName: "multicall",
      args: [router.calls],
      account: input.from,
      value: router.value,
    });
  } catch (err) {
    logGmxSimulateRevert(err, {
      from: input.from,
      router: GMX_COLLATERAL_SPENDER_ARBITRUM,
      value: router.value.toString(),
      collateral: router.collateral.toString(),
    });
    if (isSilentGmxSimulateRevert(err)) {
      console.warn(
        "[gmx-micro-fill] simulateContract silent revert (rawData=0x); local eth_call may diverge from on-chain GMX Router execution",
      );
      if (process.env.BYPASS_SIMULATION === "true") {
        console.warn("[gmx-micro-fill] BYPASS_SIMULATION=true — skipping simulation preflight, proceeding to broadcast");
        return;
      }
    }
    throw err;
  }
}
