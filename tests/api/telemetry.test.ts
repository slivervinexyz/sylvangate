import { afterEach, describe, expect, it } from "vitest";
import { handleTelemetryHealthRequest } from "../../src/api/routes/telemetry";
import {
  __setSystemStateForTests,
  buildBlockedSystemState,
  buildSystemState,
} from "../../src/core/state";

const FORBIDDEN_PAYLOAD_KEYS =
  /private[_-]?key|secret|webhook|mnemonic|PYTHON_|STRIKE_|COACH_|TACTICAL_/i;

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("GET /api/telemetry/health", () => {
  it("returns 200 OK with public telemetry metrics", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ currentCri: 92, skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const res = handleTelemetryHealthRequest();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.criIndex).toBe(92);
    expect(body.hudState).toBeDefined();
    expect(body.soilResistance).toEqual({
      status: "PASS",
      hedgeChannelActive: true,
    });
    expect(body.activeVenues).toEqual(["HYPERLIQUID"]);
    expect(body.santenmokuStatus).toBe("THREE_EYES_ACTIVE");
    expect(body.adapterAudit).toHaveLength(1);
    expect(body.adapterAudit.every((a: { ready: boolean }) => a.ready)).toBe(
      true,
    );
    expect(body.circuitBreakers).toMatchObject({
      r20Locked: false,
      hardlock: false,
      signingChannelOpen: true,
      dynamicMaxSlUsd: expect.any(Number),
    });
    expect(body.counterAttackStatus).toBe("STANDBY");
    expect(body.lubanExoskeleton).toEqual({
      status: "SAFE",
      cushionArmed: true,
    });
    expect(body.safetyReserveEngine).toEqual({
      status: "ACTIVE",
      feeBps: 10,
    });
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns non-sensitive JSON payload structure", async () => {
    __setSystemStateForTests({
      ...buildBlockedSystemState(),
      isHedgeActive: false,
    });

    const res = handleTelemetryHealthRequest();
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(body.success).toBe(true);
    expect(body.criIndex).toBe(0);
    expect(body.soilResistance.status).toBe("LOCKED");
    expect(body.activeVenues).toEqual([]);
    expect(body.santenmokuStatus).toBe("THREE_EYES_LOCKED");
    expect(body.circuitBreakers.r20Locked).toBe(true);
    expect(body.circuitBreakers.signingChannelOpen).toBe(false);
    expect(body.counterAttackStatus).toBe("LOCKED");
    expect(body.lubanExoskeleton).toEqual({
      status: "COLLAPSE",
      cushionArmed: true,
    });
    expect(body.safetyReserveEngine.feeBps).toBe(10);
    expect(body.accountBalanceUsd).toBeUndefined();
    expect(body.systemState).toBeUndefined();
    expect(serialized).not.toMatch(FORBIDDEN_PAYLOAD_KEYS);
  });
});
