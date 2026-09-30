# SliverVine SylvanGate (Kernel Escort for Robinhood Chain)

[![Vitest](https://img.shields.io/badge/Vitest-57%2F57%20PASS%20across%2014%20test%20files-brightgreen?logo=vitest)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![SDK typecheck](https://img.shields.io/badge/SDK%20typecheck-passing-brightgreen?logo=typescript)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![Home Chain](https://img.shields.io/badge/EVM%20Chain%20ID-4663-blue?logo=ethereum)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![Reflex](https://img.shields.io/badge/p50-%7E0.107ms-blue?logo=speedtest)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![ZeroDev](https://img.shields.io/badge/ZeroDev-Kernel_v0.3.1_%C2%B7_EP_0.7-blueviolet?logo=ethereum)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![Demo](https://img.shields.io/badge/demo%3Arobinhood--sentinel-ALL%20SCENARIOS%20PASS-brightgreen?logo=pnpm)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![0-Gas](https://img.shields.io/badge/0--Gas-Severance-red)](https://github.com/SilverVineLabs/slivervine-sylvangate)
[![License](https://img.shields.io/badge/License-BUSL--1.1-orange)](./LICENSE)
[![Package](https://img.shields.io/badge/npm-%40slivervine%2Fsylvangate-lightgrey?logo=npm)](https://github.com/SilverVineLabs/slivervine-sylvangate)

<p align="center">
  <img src="./public/brand/Readme_Logo_sylvangate.jpg" alt="SliverVine SylvanGate" width="100%" />
</p>

**Balancing Security with Utility for AI Agents & Session Keys on Robinhood Chain (4663)**

`EVM Chain ID: 4663 | Test Suite: 57/57 PASS across 14 test files | p50 ~0.107ms | 0-Gas Severance`

Standalone B2B SKU (`@slivervine/sylvangate`) — part of the SliverVine stack (**SylvanGate** · ExoMesh · Sanctuary).

## Executive Summary

### Problem

AI agents and session keys on EVM chains face execution risks that appear **after** keys are issued but **before** transactions settle: permission drift across venues, signature hijacking on toxic flows, unbounded session scope, and slippage or bridge misuse that should never reach a bundler.

### Solution

**SylvanGate** is a B2B **Pre-Execution Risk Gateway** and security SDK (`@slivervine/sylvangate`) for **Robinhood Chain (4663)**. It evaluates intent **off-chain at zero gas**—block or sever **before** `signUserOperation` / broadcast. Integrates **ZeroDev Kernel v0.3.1** + EntryPoint **0.7**; not a custodial wallet or production bridge (`bridgeDeployed: false`).

**Design pillars:** **Deterministic Intent Security** · **0-Gas Pre-Sign Isolation** · **Math-based State Integrity** (fail-closed predicates, not centralized censorship).

### Architecture

| Layer | Role |
|-------|------|
| **Three-tier escort** | Home **4663** → off-chain **SylvanGate SDK** → destination **42161** metadata (`4663→42161` outbound only; inbound fail-closed; `lostUsd ≡ 0`) |
| **SystemState-style flow** | Unidirectional decision updates: allow → sign path; trip → `severSigningChannel()` (`signingChannelOpen: false`) — no UserOp on block |
| **Circuit breakers** | `checkAirlockThreshold()` (airlock, venue mandate, depth/slippage) · `SylvanGateGuard` / `guardAgentUserOp` · gateway hardlock via `rootProtection` on loss bounds (advanced integrator path; not the public SDK barrel) |

```text
Agent Intent → SylvanGateGuard + checkAirlockThreshold → allowed? → signUserOp (4663)
                                    │ trip
                                    ▼
                         severSigningChannel (0-gas block)
```

On-chain ERC-7579 hook: **not shipped** in this SKU (`hookInstalled: false`). Deep-dive: [02-cross-chain-architecture-faq.md](docs/02-cross-chain-architecture-faq.md).

### Security Matrix

- **Fhenix FHE Protection**: Optional encrypted intent validation preventing MEV front-running on Agent UserOps.
- **Paxos USDG Support**: Native Pre-Sign Airlock Isolation for USDG compliant settlement flows on Robinhood Chain (4663).

### Security Architecture

### 🛡️ Trail of Bits Security Alignment

- **Property-Based Invariants (Echidna Concept)**: Enforces invariant state conditions on 0-Gas Pre-Sign predicates.
- **Static Threat Scanning (Slither Pattern)**: Off-chain interceptor evaluates UserOp dataflow boundaries.
- **Symbolic Edge Defense (Manticore Principle)**: Resolves execution edge cases prior to session key signing.

### Emergency Protocol — Non-custodial Escape Hatch

SylvanGate **does not custody funds**. When the signing pipeline is severed, the **kernel account owner** can still execute **direct on-chain recovery** (owner EOA transactions) outside the agent/session path—non-custodial by design.

Type-only integration contract for planners and integrators: [`src/types/escape-hatch.ts`](src/types/escape-hatch.ts) (`EscapeHatchContext`, `DirectOnChainRecoveryIntent`, `EscapeHatchRecoveryPlan`). **No dedicated recovery contract is deployed in this SKU**—recovery is owner-driven on-chain action, not a hosted escape service. **`[Types Only]`** — not exported from the public SDK barrel.

## Engineering Status

| Capability | Implementation | Status |
|------------|----------------|--------|
| `SylvanGateGuard` / `guardAgentUserOp` | Off-chain pre-sign gate | `[Production Ready]` |
| `checkAirlockThreshold` | Airlock / venue mandate / severance | `[Production Ready]` |
| `validateFhenixEncryptedAirlock` | Fhenix FHE intent envelope predicate | `[Optional · Fhenix Sponsor Envelope]` |
| `validateUSDGAirlockPolicy` | Paxos USDG white-list pre-sign lane (`4663`) | `[Optional · Paxos USDG Escort Lane]` |
| `assertUnidirectionalBridge` | Outbound escort + inbound airlock | `[Production Ready]` |
| `buildRobinhoodAuditSnapshot` + integrity exports | SHA-256 state integrity attestation | `[Production Ready]` |
| 0-Gas pre-sign / `severSigningChannel` | Decision-layer severance (no on-chain gas) | `[Production Ready · Off-chain]` |
| Session keys / AI agents | Intent + airlock gate (no standalone adapter module) | `[Policy SDK · not a Session Key Adapter SKU]` |
| `rootProtection` | [`root-protection-core.ts`](src/core/root-protection-core.ts) — not in [`src/sdk.ts`](src/sdk.ts) | `[Advanced integrator API · not in public SDK]` |
| Escape Hatch | [`src/types/escape-hatch.ts`](src/types/escape-hatch.ts) only | `[Types Only · no recovery contract]` |
| ERC-7579 on-chain hook | `hookInstalled: false` | `[Not Shipped]` |
| Bridge / yield vault | `bridgeDeployed: false` | `[Decision Probe Only]` |
| Demo `0.107ms` latency | SSOT `REFLEX_P50_US=107` + optional live `performance.now()` | `[SSOT Badge · not end-to-end SLA]` |
| Clock Wasm | [`clock-wasm.ts`](src/sdk/clock-wasm.ts) stub → JS fallback | `[Stub · JS Fallback]` |
| ZeroDev Kernel v4 / Arbitrum probe adapters | [`src/adapters/arbitrum/zerodev-aa/`](src/adapters/arbitrum/zerodev-aa/) — probes + readiness types only | `[Integrator probes only · not in public SDK]` |
| Live-fire mainnet txs | Archived anchors; demo does not re-broadcast | `[Archived Anchor · Policy Replay]` |

## Three-Tier Architecture

```text
┌─────────────────────┐       ┌──────────────────────────┐       ┌─────────────────────┐
│   HOME · 4663       │  ──►  │  DECISION (off-chain)    │  ──►  │   DEST · 42161      │
│   Robinhood Chain   │       │  SylvanGate SDK          │       │   Arbitrum One      │
├─────────────────────┤       ├──────────────────────────┤       ├─────────────────────┤
│ Kernel UserOp       │       │ SylvanGateGuard          │       │ GM pool metadata    │
│ SVESC attestation   │       │ checkAirlockThreshold      │       │ (planned yield dest)│
│ (on-chain)          │       │ assertUnidirectionalBridge│     │ (not 4663 RPC call) │
└─────────────────────┘       └──────────────────────────┘       └─────────────────────┘
```

**Flow:** `4663 → 42161` outbound only · `42161 → 4663` fail-closed · `lostUsd ≡ 0` · Decision layer = **zero-gas** pre-sign (no Cloudflare Worker required). Deep-dive: [02-cross-chain-architecture-faq.md](docs/02-cross-chain-architecture-faq.md).

## What We Are / What We Are NOT

| We **are** | We are **not** |
|------------|----------------|
| B2B **Pre-Sign Security SDK** on Robinhood Chain `4663` | Cloudflare Worker / HTTP API gateway |
| **Off-chain decision layer** — block before sign/broadcast | Production bridge or yield vault (`bridgeDeployed: false`) |
| Integrates **ZeroDev Kernel v0.3.1** + EntryPoint **0.7** | A new ERC standard or full-chain middleware SKU |
| Release verification: `pnpm demo:robinhood-sentinel` + `pnpm test` **57/57 PASS across 14 test files** | Flagship monorepo **1156** tests / GMX·HL·Pendle core product |
| Policy replay + archived live-fire anchors | Demo re-broadcast of mainnet txs |

## Pre-Sign Lifecycle

```text
Agent / Session Key Intent
         │
         ▼
┌────────────────────────────────────────┐
│  SylvanGate SDK (off-chain · 0-gas)    │
│  SylvanGateGuard · checkAirlockThreshold   │
│  assertUnidirectionalBridge · audit snap │
└────────────────────────────────────────┘
         │ allowed?
         ▼ yes
signUserOperation (ZeroDev Kernel v0.3.1 · EP 0.7 · chain 4663)
         │
         ▼
Bundler submit → Robinhood Chain sequencer
```

**Not in this path:** EIP-1193 wallet middleware · on-chain ERC-7579 hook (`hookInstalled: false`) · Cloudflare Worker ingress.

## Judge Path — Scenario × SDK × Live-fire

| Scenario | SDK export | Demo proof | Live-fire case |
|----------|------------|------------|----------------|
| **1 — Pre-Sign Gate** | `SylvanGateGuard` / `guardAgentUserOp` · `assertUnidirectionalBridge` | `[SYLVANGATE_BLOCKED]` · `⚡ 0.107ms` · `lostUsd=0` | **A-Tier2-mainnet** [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) |
| **2 — Airlock + Venue** | `checkAirlockThreshold` · `validateAcrossBridgeDirection` | `venueDrift` · `SOURCE_AIRLOCK_INBOUND_BLOCKED` | **B1** inbound block · **B3** treasury misuse |
| **3 — Audit Cert** | `buildRobinhoodAuditSnapshot` | `sha256Signature` JSON · `inboundBlocked: true` | **B2** SSOT hash `4579da8f…cc13a` |

## Standards & ERC Boundary

| Category | This SKU | How to describe |
|----------|----------|-----------------|
| **ERC-4337** | ✅ ZeroDev Kernel v0.3.1 + EntryPoint 0.7 | “Integrates with ZeroDev AA” |
| **ERC-7579** | Readiness types only (`hookInstalled: false`) | “Readiness for Kernel v4 Condition Interface” |
| **Application layer** | SHA-256 audit snapshot · `SVESC` attestation stub | Decision certificate — **not** a new ERC |
| **ERC-7540 / 7683 / 8196** | ❌ Pruned from spinoff | Not shipped in this SKU |
| **EIP-1193 / 5792** | ❌ Not shipped | Not wallet middleware |

## SSOT Positioning & B2B Usage

SylvanGate is a **lightweight B2B Pre-Sign Security SDK** for ZeroDev AA Kernel on Robinhood Chain (`4663`):

- **Active:** Kernel **v0.3.1** + EntryPoint **0.7**
- **Readiness:** Kernel **v4** Extendable Condition types (`ZERODEV_KERNEL_V4_CONDITION_INTERFACE_READY`) — not a runtime switch in this SKU

**SDK barrel** ([`src/sdk.ts`](src/sdk.ts)):

| Export | Role |
|--------|------|
| `SylvanGateGuard` / `guardAgentUserOp` | Async pre-sign gate — block before sign/broadcast |
| `SylvanGatePreSignGate` / `evaluateAgentExoMeshGuard` | Sync intent + airlock evaluation |
| `checkAirlockThreshold` | Slippage / depth / venue drift airlock fuse |
| `buildRobinhoodAuditSnapshot` | SHA-256 state integrity attestation |
| `exportRobinhoodAuditSnapshot` / `exportDailyRobinhoodIntegrityReport` | Integrity helpers (stdout / daily rollup) |
| `formatDailyUtcCutoff` / `formatDailyUtcDate` | UTC cutoff formatting for audit exports |
| `assertUnidirectionalBridge` | Outbound escort + inbound airlock predicate |
| Chain / gate constants (`ROBINHOOD_*`, `SLIVERVINE_GATE_*`, EIP-712 domain wires) | SSOT addresses and signing domain metadata |

**Not in barrel:** `escape-hatch.ts` types · `rootProtection` · session-key stubs with secret material.

```typescript
import { SylvanGateGuard, checkAirlockThreshold } from "./src/sdk";
// Published: import { ... } from "@slivervine/sylvangate";

// Sub-millisecond pre-sign evaluation before sending UserOp
const guard = await SylvanGateGuard({ intent, airlock });
if (!guard.allowed) {
  // Severed at 0-Gas before signing/broadcasting
  console.log(guard.reject?.payload.reasons);
}
```

> **Honesty:** The gate evaluates **intent + airlock** (not raw `UserOperation` bytes). Call `SylvanGateGuard` before `signUserOperation` / bundler submit.

## Three Validation Scenarios

`pnpm demo:robinhood-sentinel` runs an **interactive** judge CLI (press Enter between scenarios). Use `DEMO_AUTO=1` for non-interactive CI / `pnpm build`.

### Scenario 1 — SylvanGate Pre-Sign Gate (AI Agent UserOp Escort)

- Toxic intent blocked via `SylvanGateGuard` → `[SYLVANGATE_BLOCKED]` · `[SEVERED: 0 Gas Spent]`
- Healthy path: `⚡ 0.107ms (Sub-ms Reflex)` pre-sign latency
- Outbound escort replay: `4663 → 42161` · `lostUsd ≡ 0`
- On-chain mainnet anchor: [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) — **NOT** re-broadcast by this CLI

### Scenario 2 — Permissioned Airlock Gate (Inbound Boundary / Venue Drift Block)

- Venue drift: `unauthorized_hook_dex` ∉ `{uniswap_v4, pons_launchpad, usd_vault}`
- Inbound boundary `42161 → 4663` fail-closed · source airlock `SOURCE_AIRLOCK_INBOUND_BLOCKED`
- Decision probe only — **not** EIP-1193 wallet middleware

### Scenario 3 — SHA-256 State Integrity Attestation

- Emits `buildRobinhoodAuditSnapshot()` JSON to stdout
- `protocol: "SliverVine-SylvanGate"` · live `cutoffTimestamp` / `sha256Signature`
- Aligns with live-fire **B2** artifact ([index](docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md))

## Code-Honesty & Safety Boundaries

| Flag | Meaning |
|------|---------|
| **`hookInstalled: false`** | Off-chain Pre-Sign Gate SDK only; on-chain ERC-7579 Type-4 hook on roadmap ([`zerodev-aa-kernel.ts`](src/adapters/arbitrum/zerodev-aa/zerodev-aa-kernel.ts)) |
| **`bridgeDeployed: false`** | Decision probes & 0-broadcast execution — not a production bridge |
| **`0-Liability`** | Non-custodial decision layer; no legal, regulatory, or custody guarantees |
| **Demo = policy replay** | `pnpm demo:robinhood-sentinel` does not re-broadcast archived live-fire txs |

Omni-chain design surface and route honesty: [docs/02-cross-chain-architecture-faq.md](docs/02-cross-chain-architecture-faq.md) (judge CLI permits **4663 → 42161** only today).

## Quick Start

```bash
git clone https://github.com/SilverVineLabs/slivervine-sylvangate.git
cd slivervine-sylvangate && pnpm install
pnpm test                      # 57/57 PASS across 14 test files (incl. security regression tests)
pnpm typecheck:sdk             # Public SDK closure (src/sdk.ts import graph)
pnpm typecheck:adapters        # Narrow tsconfig.json · probe adapter closure
pnpm demo:robinhood-sentinel     # Interactive 3-scenario judge CLI
```

> **Typecheck honesty:** Release verification uses `pnpm test` + `pnpm typecheck:sdk`. Maintainers may also run `pnpm typecheck:adapters` (ZeroDev probe types under `src/adapters/arbitrum/` — not exported from `src/sdk.ts`). Canonical test counts: [`judge-bar-ssot.json`](docs/_snippets/judge-bar-ssot.json).

```bash
# Non-interactive (CI / pnpm build)
DEMO_AUTO=1 pnpm demo:robinhood-sentinel
```

**Install (when published):** `pnpm add @slivervine/sylvangate`

---

## Live-Fire Evidence (Archived)

Index: [docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md](docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)

| Case | Chain | Explorer / artifact |
|------|-------|---------------------|
| A-Tier2-mainnet | **4663** | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) · [JSON](docs/logging/robinhood_livefire_outbound_2026-09-21T03-00-51-080Z.json) |
| A-Tier2 | 46630 testnet | [0x4574c97f…fcf6](https://explorer.testnet.chain.robinhood.com/tx/0x4574c97ff91b5321c3281c535577a1a55908f4e92de8c3ecb55433e94735fcf6) · [JSON](docs/logging/robinhood_livefire_outbound_2026-09-21T01-49-53-777Z.json) |
| A-Tier1 Smart Route | 46630→42161 | [Arbiscan tx](https://arbiscan.io/tx/0xdca66358ffb9a2463d1069722ea27dcfabe1d374dc1d5264698c74341bb02a2f) · [JSON](docs/logging/robinhood_livefire_tier1_2026-09-21T02-02-17-204Z.json) |
| B1 airlock block | decision · 0 broadcast | [JSON](docs/logging/robinhood_livefire_inbound_block_2026-09-21T01-54-27-239380566Z.json) |
| B2 audit cert | decision | [JSON](docs/logging/robinhood_livefire_inbound_audit_2026-09-21T02-09-39-263Z.json) |
| B3 treasury misuse | decision · 0 broadcast | [JSON (2026-09-21)](docs/logging/robinhood_livefire_inbound_treasury_2026-09-21T02-09-41-885Z.json) · [JSON (2026-09-25)](docs/logging/robinhood_livefire_inbound_treasury_2026-09-25T03-37-29-629Z.json) |

### Probe harnesses

```bash
pnpm probe:rchain-mainnet
pnpm probe:rchain-testnet
pnpm probe:robinhood-inbound-treasury
```

## Omni-Chain Extensibility

Robinhood Chain (`4663`) is the sole **Home Chain**. Agents pass `checkAirlockThreshold()` at 0-Gas before sign, then declare outbound `destChainId` via escort attestation APIs.

- **Demo today:** Scenario 1 + live-fire target Arbitrum GM (`destChainId: 42161`)
- **Design surface:** `destChainId` is a runtime variable in `SVESC` attestation calldata
- **Inbound invariant:** `* → 4663` fail-closed at `SOURCE_AIRLOCK_INBOUND_BLOCKED`
- **Honesty:** Route predicate permits **4663 → 42161** only in this SKU judge CLI

## Optional Complements (Decision-Only)

- **Airlock threshold** — `checkAirlockThreshold` gates high-volatility swaps before wallet sign (0-Gas on trip); not wallet middleware
- **Treasury escort feed** — `quoteRChainYieldToArbitrumGm()` + audit snapshot formatting; no Hyperdash / websocket integration shipped

## Core Modules

- `src/core/agent-exomesh-guard.ts` — `SylvanGateGuard` / pre-sign gate
- `src/core/risk-engine-airlock.ts` — `checkAirlockThreshold`
- `src/adapters/across-ingress-bridge.ts` — unidirectional bridge state machine
- `src/adapters/arbitrum/zerodev-aa/` — Kernel / EntryPoint constants
- `src/sdk/robinhood-audit-snapshot.ts` — SHA-256 audit certificate

## Relationship to Flagship Monorepo

Extracted from the [SliverVine Protocol Monorepo](https://github.com/SilverVineLabs/bedelta-living-water) for Robinhood Chain (`4663` / `46630`).

| | This SKU (`@slivervine/sylvangate`) | Flagship (`bedelta-living-water`) |
|---|-------------------------------------|-----------------------------------|
| **Scope** | Robinhood Pre-Sign Gate + Airlock + Audit | Full Citadel gateway — GMX, Worker, multi-venue airlock |
| **Tests** | **57/57 PASS across 14 test files** — `pnpm test` | Monorepo-wide Vitest (`pnpm test:inherited`) |
| **Judge CLI** | `pnpm demo:robinhood-sentinel` — **ALL SCENARIOS PASS** | `demo:exomesh` / venue demos / Worker API |
| **Mainnet proof** | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) on **4663** | Multi-chain live-fire telemetry |

**Not included:** Cloudflare Worker ingress, EIP-1193 wallet middleware source, production vault deploy (`contractDeployed: false`). SylvanGate is a **zero-gas, off-chain Pre-Sign SDK** — Worker/KV are flagship platform concerns, not deployment prerequisites. See [SECURITY.md](SECURITY.md) · [01-technical-blueprints.md](docs/01-technical-blueprints.md) · [02-cross-chain-architecture-faq.md](docs/02-cross-chain-architecture-faq.md).
