import { describe, expect, it } from "vitest";
import {
  SOURCE_AIRLOCK_INBOUND_BLOCKED,
  isInboundToRobinhoodRoute,
  isRobinhoodToArbitrumRoute,
  validateAcrossBridgeDirection,
} from "../../src/adapters/across-ingress-bridge";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../../src/sdk/constants";

const OMNI_DESTS = [10, 8453, 1] as const;
const INBOUND_SOURCES = [10, 8453, 1, 42161] as const;

describe("across-ingress-bridge omni honesty", () => {
  it("rejects Robinhood outbound to non-42161 EVM destinations (not shipped)", () => {
    for (const destChainId of OMNI_DESTS) {
      expect(isRobinhoodToArbitrumRoute(ROBINHOOD_MAINNET_CHAIN_ID, destChainId)).toBe(false);
      const dir = validateAcrossBridgeDirection({
        sourceChainId: ROBINHOOD_MAINNET_CHAIN_ID,
        destChainId,
      });
      expect(dir.ok).toBe(false);
      expect(dir.reasons).toContain("BRIDGE_ROUTE_UNSUPPORTED");
    }
  });

  it("blocks inbound capital from any non-Robinhood source into 4663", () => {
    for (const sourceChainId of INBOUND_SOURCES) {
      expect(isInboundToRobinhoodRoute(sourceChainId, ROBINHOOD_MAINNET_CHAIN_ID)).toBe(true);
      const dir = validateAcrossBridgeDirection({
        sourceChainId,
        destChainId: ROBINHOOD_MAINNET_CHAIN_ID,
      });
      expect(dir.ok).toBe(false);
      expect(dir.inboundBlocked).toBe(true);
      expect(dir.reasons).toContain(SOURCE_AIRLOCK_INBOUND_BLOCKED);
    }
  });
});
