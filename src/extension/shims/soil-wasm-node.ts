/** Browser shim — extension bundle has no Node `fs` Wasm loader. */
export function readDefaultWasmBytesSync(): Uint8Array | null {
  return null;
}
