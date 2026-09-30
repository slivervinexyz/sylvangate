/**
 * SKU-slim vitest setup — SylvanGate SKU spin-off.
 * Avoid venue adapter / Arbitrum probe imports so across-ingress tests stay isolated.
 */
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});
