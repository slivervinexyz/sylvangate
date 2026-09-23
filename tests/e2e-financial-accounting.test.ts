/** E2E financial accounting invariant tests — dynamic ledger vs proof JSON. */
import { describe, expect, it } from "vitest";
import { buildE2eProofPayload } from "../examples/lib/e2e-proof-persister";
import {
  buildE2eCapitalInvariant,
  computeE2eFinancialLedger,
} from "../examples/lib/e2e-financial-accounting";
import type { E2ePipelineResult } from "../examples/lib/e2e-demo-types";

const MOCK_CORE: Omit<E2ePipelineResult, "pipelineSteps" | "s5"> = {
  s1: { ok: true, wasmUsed: true, wasmHotPathUs: 12, wasmP50Us: 106, nodeE2eRttUs: 200, deadmanOk: true },
  s2: { outboundOk: true, inboundBlocked: true, capitalLabel: "$2,500 USDC" },
  s3: { uiFeeReceiver: "0xdead", uiFeeBps: 10, underweightSide: "ETH", payloadRef: "sha16:abc" },
  s4: { ok: true, dryRun: true, notionalUsd: 1200, oid: 1, detail: "sandbox", ethShortSize: "0.3463" },
};

describe("e2e financial accounting", () => {
  it("credits GMX uiFee to protocol treasury while user principal stays $2,500", () => {
    const ledger = computeE2eFinancialLedger();
    expect(ledger.builderRebateEarnedUsd).toBe(2.4);
    expect(ledger.finalUserVaultBalanceUsd).toBe(2500);
    expect(ledger.lostUsd).toBe(0);
    expect(Math.max(0, ledger.initialCapitalUsd - ledger.finalUserVaultBalanceUsd)).toBe(0);
  });

  it("deltaNetEth === 0 between GMX GM long exposure and Hyperliquid short hedge", () => {
    const ledger = computeE2eFinancialLedger();
    const deltaNetEth =
      ledger.gmxEffectiveLongUsd / 3465 - ledger.hlHedgeShortUsd / 3465;
    expect(deltaNetEth).toBe(0);
    expect(ledger.deltaNetEth).toBe(0);
    expect(ledger.deltaNetEthFormatted).toBe("0.0000");
    expect(ledger.hlHedgeEthSize).toBe("0.3463");
  });

  it("proof payload capitalInvariant matches dynamically computed ledger (4-step happy path)", () => {
    const ledger = computeE2eFinancialLedger();
    const expected = buildE2eCapitalInvariant();
    const payload = buildE2eProofPayload("dry-run", { pipelineSteps: 4, ...MOCK_CORE });

    expect(payload.pipelineSteps).toBe(4);
    expect(payload.steps["5_r20PanicFlash"]).toBeUndefined();
    expect(payload.capitalInvariant).toEqual(expected);
    expect(payload.steps["3_gmxGmPoolDeposit"].gmDepositUsd).toBe(ledger.gmxDepositUsd);
    expect(payload.capitalInvariant.finalUsd).toBe(2500);
    expect(payload.capitalInvariant.protocolTreasuryRebateUsd).toBe(2.4);
    expect(payload.capitalInvariant.lostUsd).toBe(0);
  });

  it("proof payload includes step 5 when unwind exercise is recorded", () => {
    const payload = buildE2eProofPayload("dry-run", {
      pipelineSteps: 5,
      ...MOCK_CORE,
      s5: { r20Locked: true, severTarget: "R20", cancelCount: 1, closeCount: 1, withinBudget: true },
    });
    expect(payload.pipelineSteps).toBe(5);
    expect(payload.steps["5_r20PanicFlash"]?.ok).toBe(true);
  });
});
