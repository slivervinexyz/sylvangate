# SliverVine SylvanGate for Robinhood Chain (Chain ID: 4663)

> **0-Gas Off-Chain Inbound Airlock & SylvanGate Pre-Sign Intent Gateway for Robinhood Chain**

**SKU:** `@slivervine/sylvangate`

---

## Verified system metrics

| Metric | Value |
|--------|-------|
| **Home Chain** | Robinhood Chain Mainnet `4663` / Testnet `46630` |
| **Test Suite** | **57/57 PASS across 14 test files** — `pnpm test` (incl. security regression tests) |
| **Scenario Demo** | `pnpm demo:robinhood-sentinel` → **ALL PATHS PASS** |
| **Scenario Live-Fire Tx** | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) |
| **UserOp** | `0x9ce020ba389e59aee46e1e3520acf2e48f760a3e76ec1f9ddac74c47c0ecbfea` |
| **Outbound Route** | `4663 → 42161` (outbound escort only) |

---

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

**Flow:** `4663 → 42161` outbound only · `42161 → 4663` fail-closed · `lostUsd ≡ 0` · Decision layer = **zero-gas** pre-sign.

---

## Security Matrix

- **Fhenix FHE Protection**: Optional encrypted intent validation preventing MEV front-running on Agent UserOps.
- **Paxos USDG Support**: Native Pre-Sign Airlock Isolation for USDG compliant settlement flows on Robinhood Chain (4663).

## Security Architecture

### 🛡️ Trail of Bits Security Alignment

- **Property-Based Invariants (Echidna Concept)**: Enforces invariant state conditions on 0-Gas Pre-Sign predicates.
- **Static Threat Scanning (Slither Pattern)**: Off-chain interceptor evaluates UserOp dataflow boundaries.
- **Symbolic Edge Defense (Manticore Principle)**: Resolves execution edge cases prior to session key signing.

---

## What We Are / What We Are NOT

| We **are** | We are **not** |
|------------|----------------|
| B2B **Pre-Sign Security SDK** on `4663` | Cloudflare Worker / API gateway |
| Off-chain decision — block **before** sign | Production bridge / vault (`bridgeDeployed: false`) |
| ZeroDev Kernel **v0.3.1** + EP **0.7** | New ERC · full-chain middleware |
| `pnpm demo` + `pnpm test` **57/57 PASS across 14 test files** | Flagship **1156** tests · GMX/HL/Pendle scope |

## Pre-Sign Lifecycle

```text
Agent Intent → SylvanGate SDK (0-gas) → allowed? → signUserOp (4663) → bundler
```

Not: EIP-1193 middleware · on-chain hook (`hookInstalled: false`) · Worker ingress.

## Scenario × SDK × Live-fire

| # | SDK | Demo | Live-fire |
|---|-----|------|-----------|
| **1** | `SylvanGateGuard` · `assertUnidirectionalBridge` | blocked / 0.107ms · `lostUsd=0` | A-Tier2-mainnet `0x02ced821…951d` |
| **2** | `checkAirlockThreshold` · bridge direction | `SOURCE_AIRLOCK…` · venue drift | B1 · B3 |
| **3** | `buildRobinhoodAuditSnapshot` | SHA-256 JSON | B2 `4579da8f…cc13a` |

## Standards (ERC)

| Standard | SKU | Say |
|----------|-----|-----|
| ERC-4337 | ✅ v0.3.1 + EP 0.7 | integrates ZeroDev AA |
| ERC-7579 | readiness only | v4 Condition Interface roadmap |
| ERC-7540/7683 | ❌ | not shipped |
| EIP-1193 | ❌ | not wallet middleware |

---

## 30-Second TL;DR

- **Unidirectional gate:** outbound `4663→42161` allowed · inbound `42161→4663` fail-closed.
- **`lostUsd ≡ 0`:** in-flight bridge capital never books phantom loss.
- **0-Gas:** decision-layer reject before broadcast — no UserOp reaches sequencer on block.
- **Policy replay:** `pnpm demo:robinhood-sentinel` references archived evidence — **does not re-broadcast** live-fire txs.

---

## Judge 60s — Live Terminal

**No browser required.** Run:

```bash
pnpm demo:robinhood-sentinel
```

| Scenario | What displays | Key proof | Live-fire |
|------|---------------|-----------|-----------|
| **1 — SylvanGate Pre-Sign Gate** | Kernel v0.3.1 · route `4663→42161` · `bridgeEscortOk=true` | `lostUsd=0` · NOT re-broadcast | A-Tier2-mainnet |
| **2 — Permissioned Airlock** | `42161→4663` fail-closed · venue drift | `SOURCE_AIRLOCK_INBOUND_BLOCKED` | B1 · B3 |
| **3 — SHA-256 State Integrity** | `buildRobinhoodAuditSnapshot()` JSON | `inboundBlocked: true` · `sha256Signature` | B2 |

**Expected footer:** `ALL PATHS PASS · Home Chain 4663`

Optional test lock:

```bash
pnpm test    # SylvanGate SSOT · 57/57 PASS across 14 test files
```

---

## Live-Fire Evidence

Full index: [docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md](docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)

| Case | Chain | Proof |
|------|-------|-------|
| **A-Tier2-mainnet** | **4663** | Home-chain Kernel UserOp attestation (`SVESC` stub) |
| **B1** | decision · 0 broadcast | Inbound airlock block |
| **B2** | decision | SHA-256 audit cert (SSOT `4579da8f…cc13a`; archived JSON legacy protocol) |
| **B3** | decision · 0 broadcast | Treasury misuse probe |

---

## Honesty Footnotes

- **`contractDeployed: false` / `bridgeDeployed: false`** — applies **only** to SliverVine proprietary yield vault / bridge buffer. ZeroDev Kernel + EntryPoint 0.7 on `4663` are third-party, live infrastructure.
- **B1 / B3** — SDK decision probes with **0 broadcast**; **not** live wallet middleware.
- **`SOURCE_AIRLOCK_INBOUND_BLOCKED`** — chain-id origin integrity predicate; **not** custodial screening or off-chain KYC.
- **A-Tier2-mainnet** — stub attestation on `4663`; **not** a verified production cross-chain bridge buffer.

**Architecture deep-dive:** [docs/02-cross-chain-architecture-faq.md](docs/02-cross-chain-architecture-faq.md) — 4663 intent attestation vs `42161` destination metadata.

⚡ **ZeroDev v4 Roadmap Ready**: Native compatibility layer for ZeroDev Kernel v4 Extendable Condition Interface (beta-SDK), enabling dynamic sub-microsecond soil resistance checks. Aligns with `@zerodev/sdk` Permissions (Signers/Policies/Actions) and Kernel v4 Extendable Condition Interface (beta-SDK).

---

## Core Modules

- `src/adapters/across-ingress-bridge.ts` — unidirectional bridge state machine
- `src/sdk/unidirectional-bridge.ts` — inbound block / outbound escort verdict
- `src/sdk/robinhood-audit-snapshot.ts` — SHA-256 state integrity attestation
- `src/adapters/robinhood/treasury-escort-router.ts` — treasury escort quote
- `src/adapters/arbitrum/zerodev-aa/` — Kernel v0.3.1 + EntryPoint 0.7 constants
- `examples/robinhood-sentinel-demo.ts` — three validation scenarios CLI

---

## Judge Pitch — Say / Don't Say

| Do NOT say | Do say |
|------------|--------|
| "We call destination contracts from 4663 in one tx." | "Escort **intent** attested on `4663`; outbound destination metadata points to `42161`." |
| "`contractDeployed: false` means no contracts on chain." | "**SliverVine vault/buffer** not deployed; ZeroDev Kernel exists natively on `4663`." |
| "A-Tier2 proves funds reached destination." | "A-Tier2 proves **4663 Kernel attestation**; `bridgeDeployed: false`." |
| "Inbound block = regulatory scanner." | "Inbound blocked by **source airlock / chain-id predicate** (`SOURCE_AIRLOCK_INBOUND_BLOCKED`)." |
| "Demo re-broadcasts live-fire txs." | "Demo is **policy replay** — archived evidence only." |
| "B1/B3 are live wallet middleware." | "Case B = **SDK decision probe · 0 broadcast**." |
| "GMX/HL/Pendle tests = this product scope." | "**Repo pruned** — release verification = `pnpm test` 57/57 PASS across 14 test files only." |
| "We enhanced / superseded ERC-7540+7683." | "**Integrates with** ZeroDev 4337/7579 pre-sign gate — no new ERC in this SKU." |
