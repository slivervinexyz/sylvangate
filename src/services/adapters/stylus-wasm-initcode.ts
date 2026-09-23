/** Official cargo-stylus initcode + activation (SSOT for Brotli/EOF/project hash). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hex } from "viem";

export const STYLUS_MAINNET_CONTRACT = "0xc23587d6573dd134f95b02b0202ffbf84686625e" as const;
export const STYLUS_MAINNET_ACTIVATION_TX = "0x92079e150697717af75b0b750ff80be36d06212337189ef368bf65fead6c9397" as const;
/** @deprecated Use STYLUS_MAINNET_CONTRACT */
export const STYLUS_PRE_DEPLOYED_MAINNET = STYLUS_MAINNET_CONTRACT;

export function runCargoStylus(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; output: string } {
  const r = spawnSync("cargo", ["stylus", ...args], { cwd, encoding: "utf8", env });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

export function stylusCliEnv(rpc: string): NodeJS.ProcessEnv {
  return { ...process.env, STYLUS_ENDPOINT: rpc, STYLUS_RPC_URL: rpc, RPC_URL: rpc };
}

/** cargo stylus get-initcode — exact Nitro-compatible deployment bytecode. */
export function loadProjectInitcode(stylusProjectDir: string): Hex {
  const outDir = mkdtempSync(join(tmpdir(), "stylus-init-"));
  const outFile = join(outDir, "initcode.hex");
  try {
    const result = runCargoStylus(["get-initcode", "--output", outFile], stylusProjectDir);
    if (!result.ok) throw new Error(`cargo stylus get-initcode failed:\n${result.output}`);
    const raw = readFileSync(outFile, "utf8").trim();
    return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

export function parseStylusTxHash(output: string): Hex | null {
  const match = output.match(/with tx\s+[^\n]*?(0x[a-fA-F0-9]{64})/i)
    ?? output.match(/tx hash:\s*[^\n]*?(0x[a-fA-F0-9]{64})/i)
    ?? output.match(/0x[a-fA-F0-9]{64}/g);
  if (!match) return null;
  const tx = Array.isArray(match) ? match[match.length - 1] : match[1];
  return (tx?.startsWith("0x") ? tx : null) as Hex | null;
}

/** cargo stylus activate — official ArbWasm 0x71 activation with correct data fee. */
export function activateStylusContract(input: {
  stylusProjectDir: string;
  rpc: string;
  privateKey: string;
  address: Hex;
  maxFeeGwei?: string;
}): { ok: boolean; output: string; txHash: Hex | null } {
  const args = [
    "activate", "--address", input.address, "--endpoint", input.rpc, "--private-key", input.privateKey,
  ];
  if (input.maxFeeGwei) args.push("--max-fee-per-gas-gwei", input.maxFeeGwei);
  const result = runCargoStylus(args, input.stylusProjectDir, stylusCliEnv(input.rpc));
  return { ok: result.ok, output: result.output, txHash: parseStylusTxHash(result.output) };
}
