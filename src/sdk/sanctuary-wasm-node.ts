/** Node-only `sanctuary_invariants.wasm` bytes loader. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readSanctuaryWasmBytesSync(): Uint8Array | null {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return new Uint8Array(readFileSync(join(here, "../../pkg/sanctuary_invariants.wasm")));
  } catch {
    return null;
  }
}
