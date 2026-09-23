import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateSanctuaryGmxWireMask,
  ensureSanctuaryWasmRuntime,
  GMX_ERR_EXECUTION_FEE,
} from "../../src/core/sanctuary-wasm-runtime";
import {
  isStylusCoprocessorActive,
  resolvePolicyGuardStylusCoprocessor,
  tryEvaluatePackedPolicyGuard,
} from "../../src/core/policy-guard-stylus-gate";
import { packSanctuaryGmxWireEval } from "../../src/core/sanctuary-packed-pack";
import { zeroAddress } from "viem";

describe("sanctuary-wasm-runtime — cold-tier GMX sink", () => {
  it("loads sanctuary_invariants.wasm and evaluates GMX wire mask", () => {
    expect(ensureSanctuaryWasmRuntime()).toBe(true);
    const mask = evaluateSanctuaryGmxWireMask(
      { slippageBps: 100, expectedMarketTokens: 1_000_000n, poolLongUsd: 7_000_000, poolShortUsd: 3_000_000 },
      { executionFee: 1n, minMarketTokens: 900_000n },
    );
    expect(mask).not.toBeNull();
    expect(mask! & GMX_ERR_EXECUTION_FEE).toBe(GMX_ERR_EXECUTION_FEE);
  });

  it("reuses pre-allocated packed buffer without per-iteration heap churn (<16 KiB / 10k)", () => {
    const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), "sanctuary-zero-alloc.worker.ts");
    const result = spawnSync(process.execPath, ["--expose-gc", "--import", "tsx", worker], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS");
  });
});

describe("policy-guard-stylus-gate — coprocessor activation", () => {
  it("skips Stylus path when coprocessor is zero", () => {
    const packed = packSanctuaryGmxWireEval(
      { slippageBps: 100, expectedMarketTokens: 10_000_000n, poolLongUsd: 5_200_000, poolShortUsd: 4_800_000 },
      { executionFee: 10n ** 15n, minMarketTokens: 9_900_000n },
    );
    const { invoked, errMask } = tryEvaluatePackedPolicyGuard(packed, zeroAddress);
    expect(invoked).toBe(false);
    expect(errMask).toBe(0);
    expect(isStylusCoprocessorActive(zeroAddress)).toBe(false);
  });

  it("invokes sanctuary eval when coprocessor is non-zero", () => {
    const packed = packSanctuaryGmxWireEval(
      { slippageBps: 100, expectedMarketTokens: 10_000_000n, poolLongUsd: 5_200_000, poolShortUsd: 4_800_000 },
      { executionFee: 10n ** 15n, minMarketTokens: 9_900_000n },
    );
    const coprocessor = resolvePolicyGuardStylusCoprocessor();
    const active = isStylusCoprocessorActive(coprocessor);
    const { invoked, errMask } = tryEvaluatePackedPolicyGuard(packed, active ? coprocessor : "0x0000000000000000000000000000000000000001");
    expect(invoked).toBe(true);
    expect(errMask).toBe(0);
  });
});
