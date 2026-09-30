<!-- SSOT snippet — Pre-Sign lifecycle + judge positioning tables; copy into README / JUDGE_BRIEF -->
<!-- Validation suite manifest: docs/_snippets/judge-bar-ssot.json -->

### Pre-Sign Lifecycle

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

### What We Are / What We Are NOT

| We **are** | We are **not** |
|------------|----------------|
| B2B **Pre-Sign Security SDK** on Robinhood Chain `4663` | Cloudflare Worker / HTTP API gateway |
| **Off-chain decision layer** — block before sign/broadcast | Production bridge or yield vault (`bridgeDeployed: false`) |
| Integrates **ZeroDev Kernel v0.3.1** + EntryPoint **0.7** | A new ERC standard or full-chain middleware SKU |
| Release verification: `pnpm demo:robinhood-sentinel` + `pnpm test` **55/55** (14 files · incl. security regression tests) | Flagship monorepo **1156** tests / GMX·HL·Pendle core product |
| Policy replay + archived live-fire anchors | Demo re-broadcast of mainnet txs |

### Scenario × SDK × Live-fire

| Scenario | SDK export | Demo proof | Live-fire case |
|----------|------------|------------|----------------|
| **1 — Pre-Sign Gate** | `SylvanGateGuard` / `guardAgentUserOp` · `assertUnidirectionalBridge` | `[SYLVANGATE_BLOCKED]` · `⚡ 0.107ms` · `lostUsd=0` | **A-Tier2-mainnet** [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) |
| **2 — Airlock + Venue** | `checkAirlockThreshold` · `validateAcrossBridgeDirection` | `venueDrift` · `SOURCE_AIRLOCK_INBOUND_BLOCKED` | **B1** inbound block · **B3** treasury misuse (2026-09-25 JSON) |
| **3 — Audit Cert** | `buildRobinhoodAuditSnapshot` | `sha256Signature` JSON · `inboundBlocked: true` | **B2** SSOT hash `4579da8f…cc13a` |

### Standards & ERC Boundary

| Category | This SKU | How to describe |
|----------|----------|-----------------|
| **ERC-4337** | ✅ ZeroDev Kernel v0.3.1 + EntryPoint 0.7 | “Integrates with ZeroDev AA” |
| **ERC-7579** | Readiness types only (`hookInstalled: false`) | “Readiness for Kernel v4 Condition Interface” |
| **Application layer** | SHA-256 audit snapshot · `SVESC` attestation stub | Decision certificate — **not** a new ERC |
| **ERC-7540 / 7683 / 8196** | ❌ Pruned from spinoff | Not shipped in this SKU |
| **EIP-1193 / 5792** | ❌ Not shipped | Not wallet middleware |
