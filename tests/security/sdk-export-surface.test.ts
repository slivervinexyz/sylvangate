import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as sdk from "../../src/sdk";
import { guardAgentUserOp } from "../../src/sdk";
import { readStateOverride, severSigningChannel, writeStateOverride } from "../../src/core/state-store";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const SDK_ALLOWLIST = new Set([
  "ARBITRUM_ONE_CHAIN_ID",
  "ARBITRUM_SEPOLIA_CHAIN_ID",
  "EIP712_DOMAIN_NAME",
  "EIP712_DOMAIN_VERSION",
  "GATE_EIP712_DOMAIN_EXOMESH_WIRE",
  "GATE_EIP712_DOMAIN_MAINNET_WIRE",
  "GATE_EIP712_DOMAIN_SEPOLIA_WIRE",
  "GATE_EIP712_DOMAIN_WIRE",
  "GMX_UI_FEE_BPS",
  "LOCAL_MOCK_GATE_ADDRESS",
  "ROBINHOOD_MAINNET_CHAIN_ID",
  "ROBINHOOD_TESTNET_CHAIN_ID",
  "SESSION_KEY_NOTIONAL_CAP_USD",
  "SLIVERVINE_GATE_ADDRESS",
  "SLIVERVINE_GATE_MAINNET_ADDRESS",
  "SLIVERVINE_GATE_SEPOLIA_ADDRESS",
  "SYLVANGATE_AUDIT_PROTOCOL",
  "SylvanGateGuard",
  "SylvanGatePreSignGate",
  "USDG_SYMBOL",
  "USDG_TOKEN_ADDRESS",
  "assertUnidirectionalBridge",
  "buildRobinhoodAuditSnapshot",
  "checkAirlockThreshold",
  "evaluateAgentExoMeshGuard",
  "exportDailyRobinhoodIntegrityReport",
  "exportRobinhoodAuditSnapshot",
  "formatDailyUtcCutoff",
  "formatDailyUtcDate",
  "guardAgentUserOp",
  "validateFhenixEncryptedAirlock",
  "validateUSDGAirlockPolicy",
  "resolveGateEip712DomainName",
  "resolveSliverVineGateAddress",
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_BARREL = join(__dirname, "../../src/sdk.ts");

afterEach(() => {
  writeStateOverride(null);
  vi.restoreAllMocks();
});

describe("sdk export surface (PR-A adversarial subset)", () => {
  it("barrel exports only the SylvanGate allowlist", () => {
    const keys = Object.keys(sdk).sort();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(SDK_ALLOWLIST.has(key)).toBe(true);
    }
    expect(keys).toEqual([...SDK_ALLOWLIST].sort());
  });

  it("barrel source omits secret-bearing identifiers", () => {
    const source = readFileSync(SDK_BARREL, "utf8");
    expect(source).not.toMatch(/privateKey|mnemonic|SECRET_KEY|EXOMESH_SESSION_KEY_STUB/i);
  });

  it("barrel source does not re-export arbitrum zerodev probe adapters", () => {
    const source = readFileSync(SDK_BARREL, "utf8");
    expect(source).not.toMatch(/adapters\/arbitrum|zerodev-aa/);
  });

  it("EXOMESH_SESSION_KEY_STUB is not a public barrel export", () => {
    expect("EXOMESH_SESSION_KEY_STUB" in sdk).toBe(false);
  });

  it("guardAgentUserOp reject stays offline (no fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch should not run"));

    const result = await guardAgentUserOp({
      intent: {
        maxSlippageBps: 5,
        airlockThresholdBps: 5,
        targetMarket: "USDG",
      },
      airlock: {
        symbol: "USDG",
        hlSpot: 100,
        hlPerp: 120,
        dydxPerp: 80,
        depthUsd: 1_000,
        at: SAFE_TRADING_TIME,
      },
      atMs: SAFE_TRADING_TIME.getTime(),
    });

    expect(result.allowed).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("writeStateOverride(null) clears severance latch for test hygiene", () => {
    severSigningChannel();
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
    writeStateOverride(null);
    expect(readStateOverride()).toBeNull();
  });
});
