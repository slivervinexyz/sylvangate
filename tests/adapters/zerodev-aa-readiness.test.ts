import { describe, expect, it } from "vitest";
import {
  KERNEL_V3_1,
  ZERODEV_ENTRY_POINT_VERSION,
  ZERODEV_KERNEL_V4_CONDITION_INTERFACE_READY,
  ZERODEV_KERNEL_VERSION,
} from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";

describe("zerodev-aa v4 readiness (not runtime)", () => {
  it("exports v4 condition interface readiness without switching demo kernel", () => {
    expect(ZERODEV_KERNEL_V4_CONDITION_INTERFACE_READY).toBe(true);
    expect(ZERODEV_KERNEL_VERSION).toBe(KERNEL_V3_1);
    expect(ZERODEV_ENTRY_POINT_VERSION).toBe("0.7");
  });
});
