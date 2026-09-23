import { withRetailGuardProvider } from "@slivervine/exomesh-agentic-wallet-guard";
import type { EIP1193Provider } from "@slivervine/exomesh-agentic-wallet-guard";
import { createExtensionGuardConfig } from "./guard-config";

const STORAGE_KEY = "enabled";

let rawProvider: EIP1193Provider | undefined;
let guardedProvider: EIP1193Provider | undefined;
let guardActive = false;

function isEip1193Provider(value: unknown): value is EIP1193Provider {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as EIP1193Provider).request === "function"
  );
}

function wrapProvider(provider: EIP1193Provider): EIP1193Provider {
  if (!guardedProvider || rawProvider !== provider) {
    rawProvider = provider;
    guardedProvider = withRetailGuardProvider(
      provider,
      createExtensionGuardConfig(),
    );
  }
  return guardedProvider;
}

function installEthereumHook(): void {
  const existing = (window as Window & { ethereum?: unknown }).ethereum;
  if (isEip1193Provider(existing)) rawProvider = existing;

  try {
    Object.defineProperty(window, "ethereum", {
    configurable: true,
    enumerable: true,
    get(): EIP1193Provider | undefined {
      if (!guardActive || !rawProvider) return rawProvider;
      return wrapProvider(rawProvider);
    },
    set(next: unknown): void {
      rawProvider = isEip1193Provider(next) ? next : undefined;
      guardedProvider = undefined;
    },
    });
  } catch {
    if (isEip1193Provider(existing)) rawProvider = existing;
  }
}

async function applyGuardState(enabled: boolean): Promise<void> {
  guardActive = enabled;
  if (!enabled) {
    guardedProvider = undefined;
    return;
  }
  const eth = (window as Window & { ethereum?: unknown }).ethereum;
  if (isEip1193Provider(eth)) wrapProvider(eth);
}

async function init(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const enabled = stored[STORAGE_KEY] !== false;
  installEthereumHook();
  await applyGuardState(enabled);
}

init();
