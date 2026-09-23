/**
 * ZeroDev AA Dry-Run Harness — Mock Bundler (no live broadcast, no installModule, no on-chain hook revert).
 * Asserts Kernel v3 UserOp draft, session-key scope, Risk Oracle Gate simulation (off-chain read path).
 */
import { describe, expect, it } from "vitest";
import {
  ZERODEV_ENTRY_POINT_ADDRESS,
  ZERODEV_ENTRY_POINT_VERSION,
  ZERODEV_KERNEL_VERSION,
} from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import type { EntryPoint07UserOpDraft } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-userop";
import {
  auditSessionKeyConstraints,
  SESSION_KEY_CLIP_USD,
} from "../../src/services/risk/session-audit";
import { evaluateRiskOracleUserOpGate } from "../../src/services/aa-adapter/risk-oracle-gate";

const MOCK_SENDER = "0x1111111111111111111111111111111111111111" as const;
const NOW_MS = 1_700_000_000_000;

function buildMockUserOpDraft(): {
  entryPoint: typeof ZERODEV_ENTRY_POINT_ADDRESS;
  entryPointVersion: typeof ZERODEV_ENTRY_POINT_VERSION;
  kernelVersion: typeof ZERODEV_KERNEL_VERSION;
  userOperation: EntryPoint07UserOpDraft;
} {
  return {
    entryPoint: ZERODEV_ENTRY_POINT_ADDRESS,
    entryPointVersion: ZERODEV_ENTRY_POINT_VERSION,
    kernelVersion: ZERODEV_KERNEL_VERSION,
    userOperation: {
      sender: MOCK_SENDER,
      nonce: 0n,
      callData: "0xdeadbeef",
    },
  };
}

describe("ZeroDev AA Dry-Run Harness (Mock Bundler · no TYPE-4 hook e2e)", () => {
  it("Kernel v3 UserOp draft: EP 0.7 + Kernel 0.3.1 + sender/callData structural check", () => {
    const draft = buildMockUserOpDraft();
    expect(draft.entryPointVersion).toBe("0.7");
    expect(draft.kernelVersion).toBe("0.3.1");
    expect(draft.entryPoint).toBe(ZERODEV_ENTRY_POINT_ADDRESS);
    expect(draft.userOperation.sender).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(draft.userOperation.callData).toMatch(/^0x[a-fA-F0-9]*$/);
    expect(typeof draft.userOperation.nonce).toBe("bigint");
  });

  it("session key constraint audit: clip + expiry bounds pass", () => {
    const audit = auditSessionKeyConstraints({
      agentAddress: MOCK_SENDER,
      maxOrderClipUsd: SESSION_KEY_CLIP_USD,
      expiresAtMs: NOW_MS + 24 * 60 * 60 * 1000,
      approvedAtMs: NOW_MS,
      nowMs: NOW_MS,
    });
    expect(audit.clipOk).toBe(true);
    expect(audit.expiryOk).toBe(true);
    expect(audit.ok).toBe(true);
  });

  it("Risk Oracle Gate simulation: nominal snapshot allowed", () => {
    expect(
      evaluateRiskOracleUserOpGate({ isSystemFlushed: false, statusCode: 0 }),
    ).toEqual({ allowed: true });
  });

  it.skip("P2 post-grant: oracle SHUTDOWN → on-chain TYPE-4 hook revert (raw ZeroDev SDK bypass)", () => {
    // See docs/internal/roadmap/v1.5/v1.5-kernel-erc7579-type4-hook-pilot.md — Sepolia e2e after installModule.
    expect(true).toBe(false);
  });
});
