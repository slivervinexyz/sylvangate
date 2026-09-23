# SliverVine Retail Guard — MV3 Integration Sample

**Status:** load-unpacked **sample scaffold** for wallet integrators — **not** a Chrome Web Store SKU.

## Purpose

Shows how `withRetailGuardProvider` can wrap `window.ethereum` from a Manifest V3 content script. Primary deliverable remains the npm SDK:

```ts
import { withRetailGuardProvider } from "@slivervine/exomesh-agentic-wallet-guard";
```

## Build & load

```bash
pnpm build:extension
# Chrome → Extensions → Developer mode → Load unpacked → select dist/extension (or build output path)
```

## Engineering honesty

| Claim | Reality |
|-------|---------|
| Chrome Web Store | **Not listed** — sample only |
| Wasm / `soil_core.wasm` | **`preferWasm: false`** — TS-only guard path in extension bundle |
| Production SKU | SDK import + **35/35** Vitest (`tests/sdk/retail-guard-provider.test.ts`) |

See [01_DELIVERABLES_AND_PROOFS.md](../../docs/03_product_verifications/03_DELIVERABLES_AND_PROOFS.md) · Lane 3.
