# SliverVine Kernel Escort for Robinhood Chain (Chain ID: 4663)

> **0-Gas Off-Chain Inbound Airlock & Outbound Capital Escort Gateway for Robinhood Chain**

**SKU:** `@slivervine/robinhood-sentinel-escort`

---

## SSOT System Metrics

| Metric | Value |
|--------|-------|
| **Home Chain** | Robinhood Chain Mainnet `4663` / Testnet `46630` |
| **Test Suite** | **6/6 PASS** clean — `tests/adapters/across-ingress-bridge.test.ts` |
| **Hero Demo** | `pnpm demo:robinhood-sentinel` → **ALL PATHS PASS** |
| **Hero Live-Fire Tx** | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) |
| **UserOp** | `0x9ce020ba389e59aee46e1e3520acf2e48f760a3e76ec1f9ddac74c47c0ecbfea` |
| **Outbound Route** | `4663 → 42161` (outbound escort only) |

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

| Hero | What displays | Key proof |
|------|---------------|-----------|
| **1 — Kernel Escort** | ZeroDev Kernel v0.3.1 + EntryPoint 0.7 · route `4663→42161` · `bridgeEscortOk=true` | `lostUsd=0` · archived mainnet tx (NOT re-broadcast) |
| **2 — Permissioned Airlock** | `42161→4663` fail-closed · chain-id boundary predicate | `AML_INBOUND_TO_ROBINHOOD_BLOCKED` |
| **3 — SHA-256 Audit Cert** | Full `buildRobinhoodAuditSnapshot()` JSON to stdout | `inboundBlocked: true` · `sha256Signature` emitted |

**Expected footer:** `ALL PATHS PASS · Home Chain 4663`

Optional test lock:

```bash
pnpm test    # across-ingress-bridge 6/6
```

---

## Live-Fire Evidence

Full index: [docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md](docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)

| Case | Chain | Proof |
|------|-------|-------|
| **A-Tier2-mainnet** | **4663** | Home-chain Kernel UserOp attestation (`SVESC` stub) |
| **B1** | decision · 0 broadcast | Inbound airlock block |
| **B2** | decision | SHA-256 audit cert (`c9896689…520bd9bb`) |
| **B3** | decision · 0 broadcast | Treasury misuse probe |

---

## Honesty Footnotes

- **`contractDeployed: false` / `bridgeDeployed: false`** — applies **only** to SliverVine proprietary yield vault / bridge buffer. ZeroDev Kernel + EntryPoint 0.7 on `4663` are third-party, live infrastructure.
- **B1 / B3** — SDK decision probes with **0 broadcast**; **not** live wallet middleware.
- **`AML_INBOUND_TO_ROBINHOOD_BLOCKED`** — chain-id boundary predicate; **not** an on-chain AML/KYC scanner.
- **A-Tier2-mainnet** — stub attestation on `4663`; **not** a verified production cross-chain bridge buffer.

**Architecture deep-dive:** [docs/CROSS_CHAIN_ARCHITECTURE_FAQ.md](docs/CROSS_CHAIN_ARCHITECTURE_FAQ.md) — 4663 intent attestation vs `42161` destination metadata.

⚡ **ZeroDev v4 Roadmap Ready**: Native compatibility layer for ZeroDev Kernel v4 Extendable Condition Interface (beta-SDK), enabling dynamic sub-microsecond soil resistance checks.

---

## Core Modules

- `src/adapters/across-ingress-bridge.ts` — unidirectional bridge state machine
- `src/sdk/unidirectional-bridge.ts` — inbound block / outbound escort verdict
- `src/sdk/robinhood-audit-snapshot.ts` — SHA-256 compliance certificate
- `src/adapters/robinhood/treasury-escort-router.ts` — treasury escort quote
- `src/adapters/arbitrum/zerodev-aa/` — Kernel v0.3.1 + EntryPoint 0.7 constants
- `examples/robinhood-sentinel-demo.ts` — three hero paths CLI

---

## Judge Pitch — Say / Don't Say

| Do NOT say | Do say |
|------------|--------|
| "We call destination contracts from 4663 in one tx." | "Escort **intent** attested on `4663`; outbound destination metadata points to `42161`." |
| "`contractDeployed: false` means no contracts on chain." | "**SliverVine vault/buffer** not deployed; ZeroDev Kernel exists natively on `4663`." |
| "A-Tier2 proves funds reached destination." | "A-Tier2 proves **4663 Kernel attestation**; `bridgeDeployed: false`." |
| "Inbound block = AML scanner." | "Inbound blocked by **chain-id predicate** (`AML_INBOUND_TO_ROBINHOOD_BLOCKED`)." |
| "Demo re-broadcasts live-fire txs." | "Demo is **policy replay** — archived evidence only." |
| "B1/B3 are live wallet middleware." | "Case B = **SDK decision probe · 0 broadcast**." |
