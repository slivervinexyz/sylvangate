import { describe, expect, it } from "vitest";
import {
  TOPOLOGY_NODE_UI,
  enrichSystemStateVectorEquilibrium,
  resolveActiveNode,
  resolveEquilibriumMode,
  EQUILIBRIUM_DYNAMIC_CRI_MIN,
} from "../src/services/vector-equilibrium";
import { buildSystemState } from "../src/services/systemState";

const healthyBase = () =>
  buildSystemState({
    currentCri: 100,
    skipHardlockAssert: true,
  });

describe("vector-equilibrium resolvers", () => {
  it("DYNAMIC_BALANCE when CRI >= 75 and soil clear", () => {
    expect(
      resolveEquilibriumMode(
        { currentCri: 75, hardlock: false, isStale: false, signingChannelOpen: true },
        { soilTripped: false },
      ),
    ).toBe("DYNAMIC_BALANCE");
    expect(
      resolveEquilibriumMode(
        { currentCri: 100, hardlock: false, isStale: false, signingChannelOpen: true },
        {},
      ),
    ).toBe("DYNAMIC_BALANCE");
  });

  it("PROTECTIVE_YIELD when CRI below threshold, stale, hardlocked, or soil tripped", () => {
    expect(
      resolveEquilibriumMode(
        { currentCri: 74, hardlock: false, isStale: false, signingChannelOpen: true },
        {},
      ),
    ).toBe("PROTECTIVE_YIELD");
    expect(
      resolveEquilibriumMode(
        { currentCri: 100, hardlock: false, isStale: true, signingChannelOpen: true },
        {},
      ),
    ).toBe("PROTECTIVE_YIELD");
    expect(
      resolveEquilibriumMode(
        { currentCri: 100, hardlock: true, isStale: false, signingChannelOpen: false },
        {},
      ),
    ).toBe("PROTECTIVE_YIELD");
    expect(
      resolveEquilibriumMode(
        { currentCri: 100, hardlock: false, isStale: false, signingChannelOpen: true },
        { soilTripped: true },
      ),
    ).toBe("PROTECTIVE_YIELD");
  });

  it("maps topology nodes by priority", () => {
    expect(
      resolveActiveNode(
        { currentCri: 0, hardlock: true, isStale: false, signingChannelOpen: false },
        {},
      ),
    ).toBe("NODE_ZETA_DEADLOCK");
    expect(
      resolveActiveNode(
        { currentCri: 80, hardlock: false, isStale: true, signingChannelOpen: false },
        {},
      ),
    ).toBe("NODE_KAPPA_BLOCK");
    expect(
      resolveActiveNode(
        { currentCri: 80, hardlock: false, isStale: false, signingChannelOpen: true },
        { soilTripped: true },
      ),
    ).toBe("NODE_SIGMA_HARM");
    expect(
      resolveActiveNode(
        { currentCri: 60, hardlock: false, isStale: false, signingChannelOpen: true },
        { isHedgeActive: true },
      ),
    ).toBe("NODE_THETA_HEDGE");
    expect(
      resolveActiveNode(
        { currentCri: EQUILIBRIUM_DYNAMIC_CRI_MIN, hardlock: false, isStale: false, signingChannelOpen: true },
        {},
      ),
    ).toBe("NODE_ALPHA_OPEN");
    expect(
      resolveActiveNode(
        { currentCri: 20, hardlock: false, isStale: false, signingChannelOpen: true },
        {},
      ),
    ).toBe("NODE_DELTA_SINK");
    expect(
      resolveActiveNode(
        { currentCri: 40, hardlock: false, isStale: false, signingChannelOpen: true },
        {},
      ),
    ).toBe("NODE_OMEGA_REST");
    expect(
      resolveActiveNode(
        { currentCri: 60, hardlock: false, isStale: false, signingChannelOpen: true },
        {},
      ),
    ).toBe("NODE_LAMBDA_NOMINAL");
  });

  it("enrichSystemStateVectorEquilibrium attaches derived fields via buildSystemState", () => {
    const state = healthyBase();
    expect(state.equilibriumMode).toBe("DYNAMIC_BALANCE");
    expect(state.activeNode).toBe("NODE_ALPHA_OPEN");
  });

  it("exposes tooltip copy for all eight topology nodes", () => {
    for (const gate of Object.keys(TOPOLOGY_NODE_UI)) {
      expect(TOPOLOGY_NODE_UI[gate as keyof typeof TOPOLOGY_NODE_UI].tooltip.length).toBeGreaterThan(20);
    }
  });
});
