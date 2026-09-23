import { afterEach } from "vitest";
import { __resetArbitrumGasGuardForTests } from "../../../src/services/risk/arbitrum-gas-guard";

export const TREASURY = "0x1111111111111111111111111111111111111111";
export const REFERRAL =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export function useGmxOrderPayloadTestHooks(): void {
  const prevUiFee = process.env.GMX_UI_FEE_RECEIVER;

  afterEach(() => {
    if (prevUiFee === undefined) delete process.env.GMX_UI_FEE_RECEIVER;
    else process.env.GMX_UI_FEE_RECEIVER = prevUiFee;
    __resetArbitrumGasGuardForTests();
  });
}
