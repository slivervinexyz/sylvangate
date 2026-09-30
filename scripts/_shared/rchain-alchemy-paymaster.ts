import { toHex, type UserOperation } from "viem";
import { ZERODEV_ENTRY_POINT_ADDRESS } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";

const EP07_DUMMY_SIG =
  "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as const;

type RpcUserOperation = Record<string, string>;

export function serializeUserOperationForRpc(userOperation: UserOperation): RpcUserOperation {
  const out: RpcUserOperation = {};
  for (const [key, value] of Object.entries(userOperation)) {
    if (key === "account" || value === undefined) continue;
    out[key] = typeof value === "bigint" ? toHex(value) : String(value);
  }
  return out;
}

export async function requestAlchemyGasAndPaymaster(params: {
  rpcUrl: string;
  policyId: string;
  userOperation: UserOperation;
  entryPoint?: `0x${string}`;
}): Promise<Record<string, string>> {
  const userOperation = {
    ...serializeUserOperationForRpc(params.userOperation),
    signature: params.userOperation.signature ?? EP07_DUMMY_SIG,
  };
  const res = await fetch(params.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_requestGasAndPaymasterAndData",
      params: [
        {
          policyId: params.policyId,
          entryPoint: params.entryPoint ?? ZERODEV_ENTRY_POINT_ADDRESS,
          dummySignature: EP07_DUMMY_SIG,
          userOperation,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`alchemy gas sponsor HTTP ${res.status}`);
  const body = (await res.json()) as { result?: Record<string, string>; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "alchemy_requestGasAndPaymasterAndData failed");
  if (!body.result) throw new Error("alchemy gas sponsor returned empty result");
  return body.result;
}
