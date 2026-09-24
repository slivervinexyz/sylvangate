# SliverVine Kernel Escort for Robinhood Chain (Chain ID: 4663)

**Home Chain: Robinhood Chain (4663 / 46630)** — ZeroDev Kernel Account Intent-Gate & Outbound Capital Escort.

Standalone SKU (`@slivervine/robinhood-sentinel-escort`) for the Robinhood Chain reserved slot. Kernel accounts on Robinhood Chain sponsor outbound UserOps toward Arbitrum One (`42161`) under a fail-closed intent gate. Inbound routes are blocked by a **Permissioned Airlock** (chain-id boundary predicate). Pending capital never books phantom loss (`lostUsd ≡ 0`).

## 🚀 Quickstart & Installation

**Package:** `@slivervine/robinhood-sentinel-escort` · Home chain `4663` / `46630`

### Install (integrators)

```bash
pnpm add @slivervine/robinhood-sentinel-escort
# or: npm install @slivervine/robinhood-sentinel-escort
```

> This repo is currently `private` — judges and integrators should **clone** and install locally until the package is published:

```bash
git clone https://github.com/SilverVineLabs/slivervine-kernel-escort-rhchain.git
cd slivervine-kernel-escort-rhchain && pnpm install
```

### TypeScript — intent guard @ 4663

`checkSoilResistance()` trips on slippage/depth fuse and calls `applySoilTripSeverance(true)` internally (`risk-engine-soil.ts` L76) — **0-Gas** before sign:

```typescript
import { checkSoilResistance } from "./src/core/risk-engine-soil";
import type { SoilResistanceInput } from "./src/core/soil-resistance-types";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "./src/sdk/constants";

const intent: SoilResistanceInput = { symbol: "PONS", chainId: ROBINHOOD_MAINNET_CHAIN_ID, hlSpot: 1, hlPerp: 1, dydxPerp: 1.15, orderSizeUsd: 1000, maxSlippage: 0.01, at: new Date() };
const verdict = checkSoilResistance(intent);
if (verdict.tripped) throw new Error(`0-Gas reject — severed before sign (${verdict.reasons.join(",")})`);
```

See [docs/TECHNICAL_BLUEPRINTS.md](docs/TECHNICAL_BLUEPRINTS.md) · Blueprint 4 for full Grok Bot × Pons simulation.

### Judge 10s live CLI

```bash
pnpm demo:robinhood-sentinel   # Hero 1–3 · expect ALL PATHS PASS
pnpm test                      # across-ingress-bridge 6/6
```

## Three hero paths (single CLI run)

`pnpm demo:robinhood-sentinel` executes all three paths sequentially:

### Hero 1 — Kernel Escort (Home Chain 4663)

- ZeroDev Kernel v3 + EntryPoint 0.7 intent-gate constants
- Outbound escort replay: `4663 → 42161`
- References archived mainnet tx [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) · UserOp `0x9ce020ba…cbfea`
- **NOT** re-broadcast by this CLI

### Hero 2 — Permissioned Airlock Gate

- Replays inbound boundary check `42161 → 4663` → fail-closed
- Policy code: `AML_INBOUND_TO_ROBINHOOD_BLOCKED` (chain-id predicate, not sanctions scanning)
- Decision probe only — **not** EIP-1193 wallet middleware

### Hero 3 — SHA-256 Audit Certificate

- Emits full `buildRobinhoodAuditSnapshot` JSON to stdout
- Aligns with live-fire **B2** artifact

## Live-fire evidence (archived)

Index: [docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md](docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)

| Case | Chain | Explorer / artifact |
|------|-------|---------------------|
| A-Tier2-mainnet | **4663** | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) · [JSON](docs/logging/robinhood_livefire_outbound_2026-09-21T03-00-51-080Z.json) |
| A-Tier2 | 46630 testnet | [0x4574c97f…fcf6](https://explorer.testnet.chain.robinhood.com/tx/0x4574c97ff91b5321c3281c535577a1a55908f4e92de8c3ecb55433e94735fcf6) · [JSON](docs/logging/robinhood_livefire_outbound_2026-09-21T01-49-53-777Z.json) |
| A-Tier1 Smart Route | 46630→42161 | [Arbiscan tx](https://arbiscan.io/tx/0xdca66358ffb9a2463d1069722ea27dcfabe1d374dc1d5264698c74341bb02a2f) · [JSON](docs/logging/robinhood_livefire_tier1_2026-09-21T02-02-17-204Z.json) |
| B1 airlock block | decision · 0 broadcast | [JSON](docs/logging/robinhood_livefire_inbound_block_2026-09-21T01-54-27-239380566Z.json) |
| B2 audit cert | decision | [JSON](docs/logging/robinhood_livefire_inbound_audit_2026-09-21T02-09-39-263Z.json) |
| B3 treasury misuse | decision · 0 broadcast | [JSON](docs/logging/robinhood_livefire_inbound_treasury_2026-09-21T02-09-41-885Z.json) |

### Probe harnesses

```bash
pnpm probe:rchain-mainnet
pnpm probe:rchain-testnet
pnpm tsx scripts/execute-smart-route-live-demo.ts
pnpm tsx scripts/execute-robinhood-inbound-treasury-probe.ts
```

## Complement — Retail DEX Guard (4663, decision-only)

ExoMesh soil reflex (`checkSoilResistance` / `evaluateCoreSoilSlippage`) can gate high-volatility launchpad swaps (e.g. Pons) **before wallet sign** — 0-Gas fail-closed on slippage/depth trip.

- Modules: `src/core/risk-engine-soil.ts` · `src/core/soil-wasm-runtime.ts` · `src/core/risk-severance.ts`
- Honeypot modeled via slippage + depth trip — **not** a literal `sellTax` calldata parser
- **Not** part of `pnpm demo:robinhood-sentinel` hero paths
- **Not** EIP-1193 wallet middleware in this SKU slice (`exomesh-agentic-wallet-guard` source not shipped here)

## Complement — Treasury Escort & Audit Terminal (4663, decision-only)

Verifiable capital-safety feed for Robinhood Chain traders — maps audit snapshot + treasury escort quote to Hyperdash-class **risk terminal lines** (formatting only; no UI shipped).

- `buildRobinhoodAuditSnapshot()` — dual probe: inbound `42161→4663` must fail with `AML_INBOUND_TO_ROBINHOOD_BLOCKED`; outbound `4663→42161` enforces `lostUsd ≡ 0`; emits canonical JSON + `sha256Signature` (live-fire **B2**: `c9896689…520bd9bb`)
- `quoteRChainYieldToArbitrumGm()` — treasury yield escort quote via `assertUnidirectionalBridge`; `contractDeployed: false` · `decisionReady: true`
- Example feed line: `[HYPERDASH-RISK-FEED] chain=4663 | Inbound Airlock ACTIVE | In-Flight $100 | lostUsd=0 | SHA256 Cert: c989668...`
- Live-fire: [B1 airlock](./docs/logging/robinhood_livefire_inbound_block_2026-09-21T01-54-27-239380566Z.json) · [B2 audit](./docs/logging/robinhood_livefire_inbound_audit_2026-09-21T02-09-39-263Z.json) · [A-Tier2-mainnet](./docs/logging/robinhood_livefire_outbound_2026-09-21T03-00-51-080Z.json) (`bridgeDeployed: false`)
- **Not** Hyperdash integration · **not** websocket feed · **not** wallet middleware
- Primary SKU remains Kernel Escort + Airlock + Audit Certificate (`pnpm demo:robinhood-sentinel`)

## Architecture & Honesty Boundaries

For a detailed technical breakdown of our 4663 → 42161 cross-chain intent attestation and contract deployment status, see [docs/CROSS_CHAIN_ARCHITECTURE_FAQ.md](docs/CROSS_CHAIN_ARCHITECTURE_FAQ.md).

## Honest footnotes

- **A-Tier2-mainnet** uses stub attestation · `bridgeDeployed: false` · **not** a production cross-chain bridge buffer
- **B1 / B3** are SDK decision probes with **0 broadcast** — not live wallet middleware
- **`pnpm demo:robinhood-sentinel`** is policy replay — does **not** re-broadcast archived live-fire txs

## Core modules

- `src/adapters/across-ingress-bridge.ts` — unidirectional Across state machine
- `src/adapters/robinhood/` — treasury escort router + stubs
- `src/adapters/arbitrum/zerodev-aa/` — Kernel / EntryPoint constants
- `src/sdk/robinhood-audit-snapshot.ts` — SHA-256 audit certificate
- `tests/adapters/across-ingress-bridge.test.ts` — **6/6** SSOT

## 🔗 Relationship to Flagship Monorepo

This repository is a dedicated, standalone SKU built specifically for **Robinhood Chain (Chain ID: 4663 Mainnet / 46630 Testnet)**.

It extracts and refines the **4663 ZeroDev Kernel Escort**, **Permissioned Inbound Airlock**, and **SHA-256 Audit Snapshot** from our flagship [SliverVine Protocol Monorepo](https://github.com/SilverVineLabs/bedelta-living-water).

| | This SKU (`@slivervine/robinhood-sentinel-escort`) | Flagship monorepo (`bedelta-living-water`) |
|---|---------------------------------------------------|---------------------------------------------|
| **Scope** | Robinhood-native escort decision layer only | Full Citadel gateway — GMX, Worker ingress, multi-venue soil matrix |
| **Tests** | **6/6 PASS** — `tests/adapters/across-ingress-bridge.test.ts` | Full Vitest suite (monorepo-wide) |
| **Judge CLI** | `pnpm demo:robinhood-sentinel` — self-contained, **ALL PATHS PASS** | `demo:exomesh` / venue demos / Worker API |
| **Mainnet proof** | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) on **4663** | Multi-chain live-fire + grant audit telemetry |

**Not included in this spinoff:** Cloudflare Worker ingress, full 1206-test matrix, EIP-1193 wallet middleware source, or production vault deploy (`contractDeployed: false`). See [docs/CROSS_CHAIN_ARCHITECTURE_FAQ.md](docs/CROSS_CHAIN_ARCHITECTURE_FAQ.md) for cross-chain honesty boundaries.
