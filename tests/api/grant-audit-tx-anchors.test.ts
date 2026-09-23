import { afterEach, describe, expect, it } from "vitest";
import { handleGrantAuditRequest } from "../../src/routes/grant-audit";
import { __resetGrantAuditResponseCacheForTests } from "../../src/api/routes/grant-audit";
import { __resetGmxDataStoreStatusCacheForTests } from "../../src/routes/grant-audit-lib/grant-audit-gmx-datastore";
import type { Env } from "../../src/env";
import {
  __resetArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
} from "../../src/services/risk/sequencer-guard";
import {
  __resetSoftConfirmationGuardForTests,
} from "../../src/services/risk/soft-confirmation-guard";
import { __setCrossSpreadCacheForTests } from "../../src/services/yield/cross-spread";
import { mockKv } from "./grant-audit-fixtures";

afterEach(() => {
  __resetGrantAuditResponseCacheForTests();
  __resetSequencerGuardCacheForTests();
  __resetArbitrumGasGuardForTests();
  __resetSoftConfirmationGuardForTests();
  __setCrossSpreadCacheForTests(null);
  __resetGmxDataStoreStatusCacheForTests();
});

describe("grant-audit payload — tx anchors", () => {
  it("/api/grant-audit maps Arbitrum tx hashes to Arbiscan anchors", async () => {
    const txHash =
      "0x566a07f7eb77e71057e304261cd32d0106001fdd867b05e2fa32b34aaa7bc0fa";
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({
          l1BlockHash: "0xarbstored",
          fundingEpochBlockHeight: 987654,
          txHash,
        }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env;

    const res = await handleGrantAuditRequest(env);
    const body = (await res.json()) as {
      onChainProof: {
        txHash: string;
        txArbiscanUrl: string;
        blockArbiscanUrl: string;
        verificationAnchor: string;
      };
    };
    expect(body.onChainProof.txHash).toBe(txHash);
    expect(body.onChainProof.txArbiscanUrl).toBe(`https://arbiscan.io/tx/${txHash}`);
    expect(body.onChainProof.blockArbiscanUrl).toBe("https://arbiscan.io/block/987654");
    expect(body.onChainProof.verificationAnchor).toBe(`arbiscan:tx:${txHash}`);
  });

  it("/api/grant-audit exposes Thunderhead link for on-chain fill hashes", async () => {
    const txHash =
      "0x566a07f7eb77e71057e304261cd32d0106001fdd867b05e2fa32b34aaa7bc0fa";
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({
          l1BlockHash: "0xl2stored",
          fundingEpochBlockHeight: 12345,
          spotFill: { responseHash: txHash, px: 100, sz: 0.3, crossed: false },
          perpFill: { responseHash: txHash, px: 100, sz: 0.3, crossed: false },
        }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env;

    const res = await handleGrantAuditRequest(env);
    const body = (await res.json()) as {
      thunderheadAuditUrl: string;
      makerVolumeShare: number;
      l1BlockHash: string;
      fundingEpochBlockHeight: number;
      txHashes: string[];
    };
    expect(body.txHashes).toContain(txHash);
    expect(body.thunderheadAuditUrl).toBe(
      `https://stats.hyperliquid.xyz/tx/${txHash}`,
    );
    expect(body.makerVolumeShare).toBe(1);
    expect(body.l1BlockHash).toBe("0xl2stored");
    expect(body.fundingEpochBlockHeight).toBe(12345);
  });
});
