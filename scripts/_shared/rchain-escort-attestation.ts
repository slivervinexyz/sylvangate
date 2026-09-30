import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { concat, padHex, toHex, type Hex } from "viem";

export const RCHAIN_ESCORT_ATTEST_MAGIC = "0x5356455343" as const;

export function encodeEscortAttestationCalldata(params: {
  routeId: Hex;
  destChainId: number;
  digestStub: Hex;
}): Hex {
  return concat([
    RCHAIN_ESCORT_ATTEST_MAGIC,
    padHex(params.routeId, { size: 32 }),
    toHex(params.destChainId, { size: 4 }),
    padHex(params.digestStub, { size: 32 }),
  ]);
}

export function persistRchainLivefireLog(payload: Record<string, unknown>): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(process.cwd(), "docs/logging", `robinhood_livefire_outbound_${stamp}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}
