import { describe, expect, it } from "vitest";
import {
  encodeEscortAttestationCalldata,
  RCHAIN_ESCORT_ATTEST_MAGIC,
} from "../../scripts/_shared/rchain-escort-attestation";
import { ARBITRUM_ONE_CHAIN_ID } from "../../src/sdk/constants";

describe("rchain-escort-attestation SVESC", () => {
  it("prefixes calldata with SVESC magic and encodes destChainId as 4 bytes", () => {
    const routeId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const digestStub = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const calldata = encodeEscortAttestationCalldata({
      routeId,
      destChainId: ARBITRUM_ONE_CHAIN_ID,
      digestStub,
    });
    expect(calldata.startsWith(RCHAIN_ESCORT_ATTEST_MAGIC)).toBe(true);
    expect(calldata.startsWith("0x5356455343")).toBe(true);
    expect(calldata.length).toBe(2 + 10 + 64 + 8 + 64);
  });

  it("embeds non-default destChainId without implying GMX execution", () => {
    const calldata = encodeEscortAttestationCalldata({
      routeId: "0x1111111111111111111111111111111111111111111111111111111111111111",
      destChainId: 10,
      digestStub: "0x2222222222222222222222222222222222222222222222222222222222222222",
    });
    expect(calldata.includes("0000000a")).toBe(true);
  });
});
