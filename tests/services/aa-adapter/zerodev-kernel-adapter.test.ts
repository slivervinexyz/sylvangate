import { describe, expect, it, vi } from "vitest";
import * as riskGate from "../../../src/services/aa-adapter/risk-oracle-gate";
import {
  buildKernelUserOpDraft,
  isKernelRiskOracleGateActive,
} from "../../../src/services/aa-adapter/zerodev-kernel-adapter";
import * as kernelModule from "../../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-kernel";
import * as userOpModule from "../../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-userop";

describe("zerodev-kernel-adapter", () => {
  it("skips on-chain gate when feature flag is off", async () => {
    const gateSpy = vi.spyOn(riskGate, "assertRiskOracleUserOpGateOnChain").mockResolvedValue(null);
    const kernelSpy = vi.spyOn(kernelModule, "buildKernelAccount").mockResolvedValue({
      address: "0x1111111111111111111111111111111111111111",
      account: {} as never,
      owner: {} as never,
      chainId: 42161,
      kernelVersion: "0.3.1",
      entryPoint: { address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032", version: "0.7" },
    });
    const draftSpy = vi.spyOn(userOpModule, "buildUserOpDraft").mockResolvedValue({
      entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      entryPointVersion: "0.7",
      kernelVersion: "0.3.1",
      sponsored: true,
      userOperation: {
        sender: "0x1111111111111111111111111111111111111111",
        nonce: 0n,
        callData: "0x",
      },
    });

    const draft = await buildKernelUserOpDraft({
      kernel: { chainId: 42161 },
      env: { USE_ZERODEV_AA: "false" },
    });

    expect(gateSpy).toHaveBeenCalled();
    expect(kernelSpy).toHaveBeenCalled();
    expect(draftSpy).toHaveBeenCalled();
    expect(draft.userOperation.sender).toBe("0x1111111111111111111111111111111111111111");
    expect(isKernelRiskOracleGateActive({ USE_ZERODEV_AA: "false" })).toBe(false);
  });
});
