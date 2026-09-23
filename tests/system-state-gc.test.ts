import { afterEach, describe, expect, it } from "vitest";
import { __setSystemStateForTests } from "../src/core/state";
import {
  __resetStateTransactionLogsForTests,
  appendStateTransactionLog,
  garbageCollect,
  readStateTransactionLogs,
  STATE_TX_LOG_TTL_MS,
} from "../src/services/state/system-state";

afterEach(() => {
  __setSystemStateForTests(null);
  __resetStateTransactionLogsForTests();
});

describe("system-state garbageCollect", () => {
  it("purges transaction logs older than 1 hour", () => {
    const now = Date.now();
    appendStateTransactionLog("OLD", "stale", now - STATE_TX_LOG_TTL_MS - 1);
    appendStateTransactionLog("FRESH", "keep", now - 1_000);

    const result = garbageCollect(now);
    expect(result.purged).toBe(1);
    expect(result.remaining).toBe(1);
    expect(readStateTransactionLogs()[0]?.event).toBe("FRESH");
  });
});
