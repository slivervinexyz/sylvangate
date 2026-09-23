import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import {
  SigningChannelLockedError,
  createSessionKeyAgent,
  isSigningChannelLocked,
  signHyperliquidAction,
} from "../../../src/adapters/hl/auth";
import { HardlockError } from "../../../src/services/risk-control";
import { TEST_AGENT_ADDRESS, TEST_PRIVATE_KEY } from "./auth-lib/auth-fixtures";

describe("hl/auth — Pgate risk gate integration", () => {
  const wallet = new Wallet(TEST_PRIVATE_KEY);
  const action = { type: "order", orders: [] };
  const nonce = Date.now();

  it("isSigningChannelLocked detects all lock conditions", () => {
    expect(isSigningChannelLocked({})).toBe(false);
    expect(isSigningChannelLocked({ soilResistanceTripped: true })).toBe(true);
    expect(isSigningChannelLocked({ hardlock: true })).toBe(true);
    expect(isSigningChannelLocked({ criHardlock: true })).toBe(true);
    expect(isSigningChannelLocked({ signingChannelOpen: false })).toBe(true);
  });

  it("signHyperliquidAction throws SigningChannelLockedError on soil trip", async () => {
    await expect(
      signHyperliquidAction(wallet, action, nonce, {
        gate: { soilResistanceTripped: true },
      }),
    ).rejects.toBeInstanceOf(SigningChannelLockedError);
  });

  it("signHyperliquidAction throws HardlockError on R20/CRI hardlock", async () => {
    await expect(
      signHyperliquidAction(wallet, action, nonce, {
        gate: { criHardlock: true },
      }),
    ).rejects.toBeInstanceOf(HardlockError);
  });

  it("createSessionKeyAgent throws when signing channel closed", async () => {
    await expect(
      createSessionKeyAgent(wallet, TEST_AGENT_ADDRESS, 60_000, {
        gate: { signingChannelOpen: false },
      }),
    ).rejects.toBeInstanceOf(SigningChannelLockedError);
  });
});
