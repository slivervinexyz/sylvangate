/**
 * Node-only Wasm bytes loader — aliased to browser stub during Vite SPA build.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readDefaultWasmBytesSync(): Uint8Array | null {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return new Uint8Array(readFileSync(join(here, "../../pkg/soil_core.wasm")));
  } catch {
    return null;
  }
}
