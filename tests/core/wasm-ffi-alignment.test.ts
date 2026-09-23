import { describe, expect, it } from "vitest";
import { PROTO_VECT_LEN } from "../../src/core/risk-engine-core";
import {
  WASM_PROTOCOL_LEN,
  WASM_SOIL_INPUT_BYTES,
  WASM_SOIL_INPUT_FLOATS,
  WASM_SOIL_OFFSET,
  encodeWasmSoilInput,
  readProtocolVectorFromView,
} from "../../src/core/wasm-soil-ffi";

describe("wasm-soil-ffi 28-slot alignment", () => {
  it("matches PROTO_VECT_LEN and soil offset layout", () => {
    expect(WASM_PROTOCOL_LEN).toBe(28);
    expect(WASM_PROTOCOL_LEN).toBe(PROTO_VECT_LEN);
    expect(WASM_SOIL_OFFSET).toBe(28);
    expect(WASM_SOIL_INPUT_FLOATS).toBe(36);
    expect(WASM_SOIL_INPUT_BYTES).toBe(36 * 8);
  });

  it("reads full 28-lane protocol vector with mask at slot 27", () => {
    const buf = encodeWasmSoilInput({
      hlSpot: 1,
      hlPerp: 2,
      dydxPerp: 3,
      depthUsd: 4,
      orderSizeUsd: 5,
      accountBalanceUsd: 6,
      maxSlippage: 0.005,
      minDepthUsd: 100_000,
      protocolMask: 1 << 18,
    });
    const view = new DataView(buf);
    const vec = readProtocolVectorFromView(view);
    expect(vec.length).toBe(28);
    expect(vec[27]).toBe(1 << 18);
    expect(vec[0]).toBe(0);
  });
});
