/** Production capital invariant ledger — SSOT for grant E2E + ExoMesh services. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertCapitalInvariantLedger,
  buildCapitalInvariantSnapshot,
  buildLiveCapitalLedgerParams,
  computeCapitalInvariantLedger,
} from "../../src/core/capital-invariant-ledger";
import { GMX_UI_FEE_BPS, GMX_UI_FEE_RECEIVER } from "../../src/config/gmx-revenue";
import {
  CAPITAL_DEFAULT_ETH_PRICE_USD,
  CAPITAL_DEFAULT_GMX_DEPOSIT_USD,
  CAPITAL_DEFAULT_TOTAL_VAULT_USD,
} from "../../src/config/capital-invariant-defaults";

describe("capital-invariant-ledger", () => {
  it("computes treasury rebate separately from guarded user principal", () => {
    const ledger = computeCapitalInvariantLedger({ silent: true, grantNarrativeFallback: true });
    expect(ledger.builderRebateEarnedUsd).toBe(2.4);
    expect(ledger.finalUserVaultBalanceUsd).toBe(2500);
    expect(ledger.lostUsd).toBe(0);
    expect(ledger.protocolTreasuryReceiver).toBe(GMX_UI_FEE_RECEIVER);
    expect(ledger.gmxBuilderFeeBps).toBe(GMX_UI_FEE_BPS);
    expect(ledger.provenance).toBe("grant-narrative-fallback");
  });

  it("deltaNetEth === 0 between GMX long leg and HL short hedge", () => {
    const ledger = computeCapitalInvariantLedger({
      ethPriceUsd: CAPITAL_DEFAULT_ETH_PRICE_USD,
      grantNarrativeFallback: true,
      silent: true,
    });
    const deltaNetEth =
      ledger.gmxEffectiveLongUsd / CAPITAL_DEFAULT_ETH_PRICE_USD -
      ledger.hlHedgeShortUsd / CAPITAL_DEFAULT_ETH_PRICE_USD;
    expect(deltaNetEth).toBe(0);
    expect(ledger.deltaNetEth).toBe(0);
    expect(ledger.deltaNetEthFormatted).toBe("0.0000");
    expect(ledger.hlHedgeEthSize).toBe("0.3463");
  });

  it("derives HL margin and hedge notional from parameterized inputs", () => {
    const ledger = computeCapitalInvariantLedger({
      totalVaultCapitalUsd: CAPITAL_DEFAULT_TOTAL_VAULT_USD,
      gmxDepositUsd: CAPITAL_DEFAULT_GMX_DEPOSIT_USD,
      ethPriceUsd: CAPITAL_DEFAULT_ETH_PRICE_USD,
      silent: true,
    });
    expect(ledger.hlMarginUsd).toBe(100);
    expect(ledger.gmxEffectiveLongUsd).toBe(1200);
    expect(ledger.hlHedgeShortUsd).toBe(1200);
    expect(ledger.provenance).toBe("live-rpc");
  });

  it("buildLiveCapitalLedgerParams maps telemetry into live-rpc provenance", () => {
    const params = buildLiveCapitalLedgerParams({
      gmLiquidityUsd: 2400,
      hlMarginUsd: 100,
      ethPriceUsd: 3465,
    });
    const ledger = computeCapitalInvariantLedger({ ...params, silent: true });
    expect(ledger.initialCapitalUsd).toBe(2500);
    expect(ledger.provenance).toBe("live-rpc");
  });

  it("assertCapitalInvariantLedger enforces lostUsd and deltaNet", () => {
    const ledger = computeCapitalInvariantLedger({ silent: true, grantNarrativeFallback: true });
    expect(() => assertCapitalInvariantLedger(ledger)).not.toThrow();
  });

  it("buildCapitalInvariantSnapshot maps ledger fields for proof JSON", () => {
    const snapshot = buildCapitalInvariantSnapshot({ silent: true, grantNarrativeFallback: true });
    expect(snapshot.finalUsd).toBe(2500);
    expect(snapshot.protocolTreasuryRebateUsd).toBe(2.4);
    expect(snapshot.deltaNetEth).toBe("0.0000");
    expect(snapshot.lostUsd).toBe(0);
  });

  it("rejects grant narrative fallback on mainnet", () => {
    vi.stubEnv("IS_MAINNET", "true");
    expect(() =>
      computeCapitalInvariantLedger({ grantNarrativeFallback: true, silent: true }),
    ).toThrow("CAPITAL_LEDGER_MAINNET_GRANT_FALLBACK_FORBIDDEN");
  });

  it("requires live inputs on mainnet", () => {
    vi.stubEnv("IS_MAINNET", "true");
    expect(() => computeCapitalInvariantLedger({ silent: true })).toThrow(
      "CAPITAL_LEDGER_LIVE_INPUT_REQUIRED:totalVaultCapitalUsd",
    );
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
