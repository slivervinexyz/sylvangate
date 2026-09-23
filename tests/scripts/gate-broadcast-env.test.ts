import { describe, expect, it } from "vitest";
import {
  normalizePrivateKey,
  resolveMainnetBroadcastPrivateKey,
  resolveSepoliaBroadcastPrivateKey,
} from "../../scripts/_shared/gate-broadcast-env";

const VALID_PK = `0x${"ab".repeat(32)}`;

describe("gate-broadcast-env", () => {
  it("normalizes 64-char hex without 0x prefix", () => {
    expect(normalizePrivateKey("ab".repeat(32))).toBe(VALID_PK);
  });

  it("resolves WALLET_A_PK as Sepolia fallback", () => {
    expect(resolveSepoliaBroadcastPrivateKey({ WALLET_A_PK: VALID_PK })).toBe(VALID_PK);
  });

  it("prefers PRIVATE_KEY over WALLET_A_PK on Sepolia", () => {
    const primary = `0x${"cd".repeat(32)}`;
    expect(resolveSepoliaBroadcastPrivateKey({ PRIVATE_KEY: primary, WALLET_A_PK: VALID_PK })).toBe(
      primary,
    );
  });

  it("resolves MAINNET_PK before WALLET_A_PK on mainnet", () => {
    const mainnet = `0x${"ef".repeat(32)}`;
    expect(
      resolveMainnetBroadcastPrivateKey({ MAINNET_PK: mainnet, WALLET_A_PK: VALID_PK }),
    ).toBe(mainnet);
  });
});
