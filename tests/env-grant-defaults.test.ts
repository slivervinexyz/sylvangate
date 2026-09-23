import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARB_MAINNET_USER_ADDRESS,
  DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS,
  DEFAULT_SRV_200_MAINNET_USER_ADDRESS,
  resolveDualWalletEnv,
  resolveGrantAuditEnv,
} from "../src/env-grant-defaults";

describe("env-grant-defaults", () => {
  it("fills mainnet wallet addresses when Edge bindings missing", () => {
    const dual = resolveDualWalletEnv({});
    expect(dual.HYPERLIQUID_MAINNET_USER_ADDRESS).toBe(DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS);
    expect(dual.SRV_200_MAINNET_USER_ADDRESS).toBe(DEFAULT_SRV_200_MAINNET_USER_ADDRESS);
    expect(dual.ARB_MAINNET_USER_ADDRESS).toBe(DEFAULT_ARB_MAINNET_USER_ADDRESS);
  });

  it("resolveGrantAuditEnv preserves explicit overrides", () => {
    const custom = "0x1111111111111111111111111111111111111111";
    const env = resolveGrantAuditEnv({ ARB_MAINNET_USER_ADDRESS: custom });
    expect(env.ARB_MAINNET_USER_ADDRESS).toBe(custom);
    expect(env.HYPERLIQUID_MAINNET_USER_ADDRESS).toBe(DEFAULT_HYPERLIQUID_MAINNET_USER_ADDRESS);
  });
});
