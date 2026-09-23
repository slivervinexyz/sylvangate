import { describe, expect, it } from "vitest";
import {
  RCHAIN_PROBE_MAINNET,
  RCHAIN_PROBE_TESTNET,
  buildRchainExplorerUrl,
  buildRobinhoodChain,
} from "../../scripts/_shared/rchain-probe-chain";
import {
  armedRchainProbe,
  resolveRchainZeroDevBundlerRpc,
  resolveRobinhoodProbeRpc,
} from "../../scripts/_shared/rchain-probe-env";

describe("rchain-probe-env", () => {
  it("resolves testnet RPC and bundler URL", () => {
    const env = {
      ROBINHOOD_TESTNET_RPC_URL: "https://rpc.testnet.example",
      ZERODEV_PROJECT_ID: "proj-abc",
    };
    expect(resolveRobinhoodProbeRpc(RCHAIN_PROBE_TESTNET, env)).toBe("https://rpc.testnet.example");
    expect(resolveRchainZeroDevBundlerRpc(RCHAIN_PROBE_TESTNET, env)).toBe(
      "https://rpc.zerodev.app/api/v3/proj-abc/chain/46630",
    );
  });

  it("resolves mainnet RPC and bundler URL", () => {
    const env = {
      ROBINHOOD_MAINNET_RPC_URL: "https://rpc.mainnet.example",
      ZERODEV_PROJECT_ID: "proj-abc",
    };
    expect(resolveRobinhoodProbeRpc(RCHAIN_PROBE_MAINNET, env)).toBe("https://rpc.mainnet.example");
    expect(resolveRchainZeroDevBundlerRpc(RCHAIN_PROBE_MAINNET, env)).toBe(
      "https://rpc.zerodev.app/api/v3/proj-abc/chain/4663",
    );
  });

  it("requires ZERODEV_PROJECT_ID for mainnet bundler fallback", () => {
    expect(() => resolveRchainZeroDevBundlerRpc(RCHAIN_PROBE_MAINNET, {})).toThrow(
      "ZERODEV_PROJECT_ID required",
    );
  });

  it("arms probe only when confirm + broadcast flags set", () => {
    expect(armedRchainProbe(RCHAIN_PROBE_TESTNET, {})).toBe(false);
    expect(
      armedRchainProbe(RCHAIN_PROBE_MAINNET, {
        BROADCAST: "1",
        CONFIRM_RCHAIN_MAINNET_PROBE: "YES",
      }),
    ).toBe(true);
  });

  it("builds chain and explorer URLs per target", () => {
    const chain = buildRobinhoodChain(RCHAIN_PROBE_MAINNET, "https://rpc.mainnet.example");
    expect(chain.id).toBe(4663);
    expect(
      buildRchainExplorerUrl(RCHAIN_PROBE_MAINNET, "0xabc", {
        ROBINHOOD_MAINNET_EXPLORER_URL: "https://explorer.example",
      }),
    ).toBe("https://explorer.example/tx/0xabc");
  });
});
