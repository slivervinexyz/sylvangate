# Security Policy — SliverVine SylvanGate (`@slivervine/sylvangate`)

> **Vitest:** 14 test files | **57/57 PASS** — `pnpm test` (incl. bundled security regression tests)

**Entity:** SilverVine Labs · **Contact:** `security@silvervinelabs.com`  
**Grant / audit:** `grants@silvervinelabs.com`

---

## SKU Boundary

SylvanGate (`@slivervine/sylvangate`) operates as a **zero-gas, off-chain Pre-Sign Security SDK** built on **Deterministic Intent Security**, **0-Gas Pre-Sign Isolation**, and **Math-based State Integrity** (predicate gates, not centralized censorship). Cloudflare Worker ingress and KV infrastructure belong to the **flagship platform** and are **NOT** deployment prerequisites for this SDK.

| In scope (this repo) | Out of scope (flagship / not required) |
|----------------------|----------------------------------------|
| Pre-sign intent + soil gate (`SylvanGateGuard`) | Cloudflare Worker ingress |
| Unidirectional bridge decision (`assertUnidirectionalBridge`) | KV / Durable Object state sync |
| SHA-256 audit snapshot (`buildRobinhoodAuditSnapshot`) | `GET /api/grant-audit` HTTP surface |
| Local judge CLI (`pnpm demo:robinhood-sentinel`) | EIP-1193 wallet middleware |
| Optional probe harnesses (`pnpm probe:rchain-*`) | Production vault deploy (`contractDeployed: false`) |

Integrators embed the SDK in their own runtime (Node.js, agent backend, CI). **No `wrangler deploy` is required** for release verification or B2B usage.

### Three-Tier Architecture

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

**Flow:** `4663 → 42161` outbound only · `42161 → 4663` fail-closed · `lostUsd ≡ 0`.

---

## Reporting a Vulnerability

We take security reports seriously. Please **do not** open public GitHub issues for exploitable findings.

1. Email `security@silvervinelabs.com` with:
   - Description and impact
   - Reproduction steps or proof-of-concept
   - Affected commit hash (`git rev-parse HEAD`) or release tag
2. We acknowledge within **72 hours** and aim for an initial assessment within **7 business days**.
3. Coordinate disclosure — we prefer coordinated release before public disclosure.

**Out of scope:** social engineering, physical attacks, third-party venue (GMX / Hyperliquid / Arbitrum) bugs outside the SDK decision boundary, denial-of-service without exploit chain.

---

## Fail-Closed Security Guarantees (SDK)

SylvanGate is designed **fail-closed** — ambiguous or unsafe states halt signing before broadcast:

| Layer | Module | Guarantee |
|-------|--------|-----------|
| Pre-Sign Gate | `agent-exomesh-guard.ts` | Toxic intent / slippage breach → block before UserOp sign |
| Airlock threshold | `risk-engine-airlock.ts` | Trade rejected on depth, cross-venue slippage, or venue drift |
| Inbound Airlock | `across-ingress-bridge.ts` | `* → 4663` fail-closed at `SOURCE_AIRLOCK_INBOUND_BLOCKED` |
| Unidirectional Escort | `unidirectional-bridge.ts` | Outbound escort enforces `lostUsd ≡ 0` predicate |
| Signing Severance | `state-store.ts` | Soil trip severs signing channel (`signingChannelOpen=false`) |
| Dynamic Max SL | `dynamic-max-sl.ts` | Account-balance-weighted SL — deprecated fixed $50 SL forbidden |

**No custody:** This SDK holds no user private keys. Session keys and mainnet secrets remain client-scoped — never in repo.

**Honesty:** The gate evaluates **intent + soil** (not raw `UserOperation` bytes). Call `SylvanGateGuard` before `signUserOperation` / bundler submit. `hookInstalled: false` — on-chain ERC-7579 hook is roadmap, not shipped in this SKU.

---

## Supported Versions

| Component | Branch / tag | Support |
|-----------|--------------|---------|
| `@slivervine/sylvangate` (this repo) | `main` | Active |
| Flagship Worker (`bedelta-living-water`) | separate monorepo | See flagship SECURITY policy |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Judge CLI · SDK barrel · live-fire index |
| [docs/02-cross-chain-architecture-faq.md](./docs/02-cross-chain-architecture-faq.md) | 4663→42161 SSOT · unidirectional invariant |
| [docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md](./docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md) | Archived on-chain evidence |
