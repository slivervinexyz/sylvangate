import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as PublicApi from "../../src/index";
import { simulateTransactionIntent } from "../../src/index";
import {
  __setSystemStateForTests,
  buildSystemState,
  readActiveSystemState,
} from "../../src/core/state";

const SDK_SOURCE = [
  readFileSync(resolve(import.meta.dirname, "../../src/sdk/index.ts"), "utf8"),
  readFileSync(
    resolve(import.meta.dirname, "../../src/sdk/legacy-risk.ts"),
    "utf8",
  ),
  readFileSync(
    resolve(import.meta.dirname, "../../src/sdk/agent-intent.ts"),
    "utf8",
  ),
].join("\n");

const FORBIDDEN_EXPORT_NAME =
  /private[_-]?key|secret[_-]?key|raw[_-]?secret|signing[_-]?key|api[_-]?secret|mnemonic|seed[_-]?phrase|PRIVATE_KEY|SECRET_KEY/i;

const RAW_SECRET_VALUE = /^(0x)?[0-9a-fA-F]{64}$/;

const FORBIDDEN_SOURCE_REEXPORT =
  /\bexport\b[^;\n]*\b(privateKey|secretKey|PRIVATE_KEY|SECRET_KEY|rawSecret|signingKey|mnemonic)\b/i;

const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

function collectStringLeaves(
  value: unknown,
  seen = new WeakSet<object>(),
): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object" && typeof value !== "function") return [];

  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringLeaves(item, seen));
  }

  return Object.values(value).flatMap((item) =>
    collectStringLeaves(item, seen),
  );
}

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("security audit — @slivervine/exomesh-agentic-wallet-guard export surface", () => {
  it("src/sdk source re-exports no private keys or raw secrets", () => {
    expect(SDK_SOURCE).not.toMatch(FORBIDDEN_SOURCE_REEXPORT);
  });

  it("exports zero private keys or raw secrets", () => {
    const violations: string[] = [];

    for (const [name, value] of Object.entries(PublicApi)) {
      if (FORBIDDEN_EXPORT_NAME.test(name)) {
        violations.push(`forbidden export name: ${name}`);
      }

      for (const leaf of collectStringLeaves(value)) {
        if (RAW_SECRET_VALUE.test(leaf)) {
          violations.push(`raw secret value on export "${name}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("security audit — simulateTransactionIntent dry-run", () => {
  it("never mutates active system state during dry-run", () => {
    __setSystemStateForTests({
      ...buildSystemState({
        accountBalanceUsd: 15_000,
        currentCri: 88,
        skipHardlockAssert: true,
      }),
      isHedgeActive: true,
    });

    const before = structuredClone(readActiveSystemState());

    simulateTransactionIntent(
      { venue: "HL", amountUsd: 50, soil: PASSING_SOIL },
      readActiveSystemState(),
    );
    simulateTransactionIntent({
      venue: "POLYMARKET",
      amountUsd: 25,
      soil: PASSING_SOIL,
      tailHedge: { marketPrice: 0.06 },
    });
    simulateTransactionIntent({
      venue: "JUPITER",
      amountUsd: 50,
      soil: PASSING_SOIL,
      jupiter: {
        quote: {
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          inAmount: "100000000",
          outAmount: "16198753",
          slippageBps: 10,
          priceImpactPct: "0.05",
        },
      },
    });

    expect(readActiveSystemState()).toEqual(before);
  });

  it("never mutates default system state when mockState is omitted", () => {
    const before = structuredClone(readActiveSystemState());

    simulateTransactionIntent({
      venue: "HL",
      amountUsd: 50,
      soil: PASSING_SOIL,
    });

    expect(readActiveSystemState()).toEqual(before);
  });
});
