import { Wallet, verifyTypedData } from "ethers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildExchangeAgentMessage,
  HL_AGENT_TYPES,
  HL_EXCHANGE_DOMAIN,
  signHyperliquidAction,
} from "../../../src/adapters/hl/auth";
import {
  createBrowserSessionKeyMaterial,
  loadBrowserSessionKeyMaterial,
} from "../../../src/adapters/hl/wallet/browserSessionKeyMaterial";

const MASTER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

describe("browserSessionKeyMaterial", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses the same ephemeral keypair for approveAgent address and L1 order signing", async () => {
    const first = createBrowserSessionKeyMaterial(MASTER);
    const second = createBrowserSessionKeyMaterial(MASTER);
    expect(second.agentAddress).toBe(first.agentAddress);

    const loaded = loadBrowserSessionKeyMaterial(MASTER);
    expect(loaded?.agentAddress).toBe(first.agentAddress);

    const action = { type: "order", orders: [] };
    const nonce = 1_700_000_000_000;
    const signature = await signHyperliquidAction(first.agentSigner, action, nonce, {
      isTestnet: true,
      signatureChainId: "0x3e6",
    });
    const recovered = verifyTypedData(
      HL_EXCHANGE_DOMAIN,
      HL_AGENT_TYPES,
      buildExchangeAgentMessage({ action, nonce, isTestnet: true }),
      signature,
    );
    expect(recovered.toLowerCase()).toBe(first.agentAddress);
  });

  it("persists private key in sessionStorage keyed by master wallet", () => {
    const material = createBrowserSessionKeyMaterial(MASTER);
    const raw = sessionStorage.getItem(`hl-browser-session-key:${MASTER.toLowerCase()}`);
    expect(raw?.startsWith("0x")).toBe(true);
    const wallet = new Wallet(raw!);
    expect(wallet.address.toLowerCase()).toBe(material.agentAddress);
  });
});
