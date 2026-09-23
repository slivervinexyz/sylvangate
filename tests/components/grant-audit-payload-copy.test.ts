import { describe, expect, it } from "vitest";
import { buildGrantAuditClientFallbackPayload } from "../../src/lib/gui-bridge/grant-audit/grant-audit-client-fallback";
import {
  copyGrantAuditPayload,
  serializeGrantAuditPayload,
} from "../../src/lib/gui-bridge/grant-audit/grant-audit-payload-copy";
import { formatDualVenueLatencyLabel } from "../../src/lib/gui-bridge/grant-audit/dual-venue-latency";

describe("grant-audit-payload-copy", () => {
  it("serializes fallback payload as pretty JSON", () => {
    const json = serializeGrantAuditPayload(null);
    const parsed = JSON.parse(json) as { success?: boolean };
    expect(parsed.success).toBe(true);
    expect(json).toContain('"arbitrumExomesh"');
  });

  it("copyGrantAuditPayload returns false without clipboard", async () => {
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: undefined },
    });
    await expect(copyGrantAuditPayload(buildGrantAuditClientFallbackPayload())).resolves.toBe(false);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: original });
  });
});

describe("dual-venue latency label", () => {
  it("formats Arbitrum RPC and HL Session WS probe badge", () => {
    expect(formatDualVenueLatencyLabel(18, 32)).toBe(
      "[ Arbitrum RPC: 18ms | HL Session WS: 32ms ]",
    );
  });
});
