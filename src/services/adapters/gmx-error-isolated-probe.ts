/**
 * Isolated GMX createOrder revert extraction — fund legs then probe createOrder when multicall fails silently.
 */
import { decodeFunctionData, encodeFunctionData, type CallParameters, type CallReturnType, type Hex } from "viem";
import {
  decodeGmxMarketIncreaseMulticallLegs,
  gmxRouterAbi,
} from "./gmx-market-increase-multicall";
import {
  formatGmxInterpretedError,
  interpretGmxRevertData,
  interpretGmxViemError,
  type GmxInterpretContext,
  type GmxInterpretedError,
} from "./gmx-error-interpreter";

export type GmxIsolatedProbeLeg = {
  name: "sendWnt" | "sendTokens" | "createOrder" | "multicall" | "fundMulticall";
  ok: boolean;
  interpreted: GmxInterpretedError;
};

export type GmxIsolatedProbeResult = {
  legs: GmxIsolatedProbeLeg[];
  failingLeg?: GmxIsolatedProbeLeg;
  createOrderIsolated?: GmxInterpretedError;
  summary: string;
};

export type GmxIsolatedProbeClient = {
  call: (parameters: CallParameters) => Promise<CallReturnType>;
};

async function callRouter(
  client: GmxIsolatedProbeClient,
  input: { from: Hex; to: Hex; data: Hex; value: bigint; blockNumber?: bigint },
): Promise<{ ok: boolean; data: Hex }> {
  try {
    await client.call({
      account: input.from,
      to: input.to,
      data: input.data,
      value: input.value,
      ...(input.blockNumber ? { blockNumber: input.blockNumber } : {}),
    });
    return { ok: true, data: "0x" as Hex };
  } catch (err) {
    const interpreted = interpretGmxViemError(err);
    return { ok: false, data: interpreted.rawData };
  }
}

/** Decode ExchangeRouter.multicall(bytes[]) and run per-leg + isolated createOrder probes via eth_call. */
export async function probeIsolatedGmxCreateOrderRevert(input: {
  client: GmxIsolatedProbeClient;
  from: Hex;
  router: Hex;
  multicallData: Hex;
  msgValue: bigint;
  blockNumber?: bigint;
  context?: GmxInterpretContext;
}): Promise<GmxIsolatedProbeResult> {
  const ctx = input.context ?? {};
  const decoded = decodeFunctionData({ abi: gmxRouterAbi, data: input.multicallData });
  const calls = decoded.args[0] as readonly Hex[];
  const legs = decodeGmxMarketIncreaseMulticallLegs(calls);
  const names: Array<"sendWnt" | "sendTokens" | "createOrder"> = ["sendWnt", "sendTokens", "createOrder"];
  const results: GmxIsolatedProbeLeg[] = [];

  for (let i = 0; i < calls.length; i++) {
    const value = i === 0 ? input.msgValue : 0n;
    const { ok, data } = await callRouter(input.client, {
      from: input.from,
      to: input.router,
      data: calls[i],
      value,
      blockNumber: input.blockNumber,
    });
    results.push({
      name: names[i],
      ok,
      interpreted: interpretGmxRevertData(data, ctx),
    });
  }

  const fundData = encodeFunctionData({
    abi: gmxRouterAbi,
    functionName: "multicall",
    args: [[calls[0], calls[1]]],
  });
  const funded = await callRouter(input.client, {
    from: input.from,
    to: input.router,
    data: fundData,
    value: input.msgValue,
    blockNumber: input.blockNumber,
  });
  results.push({
    name: "fundMulticall",
    ok: funded.ok,
    interpreted: interpretGmxRevertData(funded.data, ctx),
  });

  let createOrderIsolated: GmxInterpretedError | undefined;
  if (funded.ok) {
    const isolated = await callRouter(input.client, {
      from: input.from,
      to: input.router,
      data: legs.createOrder,
      value: 0n,
      blockNumber: input.blockNumber,
    });
    createOrderIsolated = interpretGmxRevertData(isolated.data, ctx);
    results.push({ name: "createOrder", ok: isolated.ok, interpreted: createOrderIsolated });
  }

  const full = await callRouter(input.client, {
    from: input.from,
    to: input.router,
    data: input.multicallData,
    value: input.msgValue,
    blockNumber: input.blockNumber,
  });
  results.push({
    name: "multicall",
    ok: full.ok,
    interpreted: interpretGmxRevertData(full.data, ctx),
  });

  const failingLeg = results.find((r) => !r.ok);
  const summary = failingLeg
    ? `GMX isolated probe: ${failingLeg.name} failed — ${failingLeg.interpreted.decoded}`
    : "GMX isolated probe: all legs succeeded";
  return { legs: results, failingLeg, createOrderIsolated, summary };
}

export function formatGmxIsolatedProbeResult(result: GmxIsolatedProbeResult): string {
  const lines = [result.summary, "── Leg probes ──"];
  for (const leg of result.legs) {
    lines.push(`${leg.ok ? "OK" : "FAIL"} ${leg.name}: ${leg.interpreted.decoded}`);
    if (!leg.ok && leg.interpreted.guidance.length) {
      lines.push(formatGmxInterpretedError(leg.interpreted));
    }
  }
  if (result.createOrderIsolated && !result.createOrderIsolated.silent) {
    lines.push("── Isolated createOrder ──", formatGmxInterpretedError(result.createOrderIsolated));
  }
  return lines.join("\n");
}
