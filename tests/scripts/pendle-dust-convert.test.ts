import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { VENUE_USDAI_ARBITRUM } from "../../src/core/venue-execution-matrix";
import { getVenueRequirement } from "../../src/core/venue-execution-matrix";
import {
  buildPendleDustConvertPlan,
  buildPendleDustRedeemPlan,
} from "../../scripts/pendle-dust-convert";

const RECEIVER = "0xef0752df6387248B897F3A59A180af42D801960d" as const;

function mockFetchJson(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  );
}

describe("pendle-dust-convert", () => {
  beforeEach(() => {
    mockFetchJson({
      action: "swap",
      routes: [
        {
          tx: { to: "0x00000000000000000000000000000000000000aa", data: "0xdeadbeef" },
          requiredApprovals: [],
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts USDai→PT body for deposit plan", async () => {
    const entry = getVenueRequirement("pendle-pt-dust")!;
    const pick = { ...entry, ptAddress: "0xb459db106f645d698e74027eef6019a26a0675cc" as const };
    await buildPendleDustConvertPlan({
      receiver: RECEIVER,
      entry: pick,
      tokenIn: VENUE_USDAI_ARBITRUM,
      amountIn: 1_000_000_000_000_000_000n,
      slippage: 0.02,
    });
    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body.inputs[0].token).toBe(VENUE_USDAI_ARBITRUM);
    expect(body.outputs[0]).toBe(pick.ptAddress);
  });

  it("posts PT→sUSDai body for redeem plan", async () => {
    const entry = getVenueRequirement("pendle-pt-dust")!;
    const pt = "0xb459db106f645d698e74027eef6019a26a0675cc" as const;
    const pick = { ...entry, ptAddress: pt };
    const tokenOut = pick.underlyingAddress ?? VENUE_USDAI_ARBITRUM;
    await buildPendleDustRedeemPlan({
      receiver: RECEIVER,
      entry: pick,
      ptAmount: 900_000_000_000_000_000n,
      tokenOut,
      slippage: 0.02,
    });
    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body.inputs[0].token).toBe(pt);
    expect(body.outputs[0]).toBe(tokenOut);
  });
});
