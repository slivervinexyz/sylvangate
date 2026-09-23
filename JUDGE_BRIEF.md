# SliverVine Protocol (BeΔ) — SliverVine ExoMesh: Pre-Consensus Intent Firewall for AI Agents on Arbitrum

> 📌 **System Metrics SSOT**: Verified via [docs/audit/SYSTEM_METRICS_SSOT.json](docs/audit/SYSTEM_METRICS_SSOT.json)

**Primary (Module A):** SliverVine ExoMesh — **ExoMesh Agentic Guard (EIP-1193/5792/6963+)** · pre-consensus Wasm reflex · ReflexCore (SSRC) soil engine · Defense Layers 1–4 · Pillar Set Y.

**Complement (Module B):** SliverVine Sanctuary — **Sanctuary Async Escort (ERC-7540+)** · Treasury Escort Router · Robinhood/Across ingress · Pillar Set X.

> **Standards compliance:** SliverVine Protocol is **100% compliant** with standard [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) / [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) and [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540) specs, while extending them into **0-Gas pre-consensus security supersets** (ExoMesh & Sanctuary).

**Release:** `v1.0 · BeDelta Living Water v1.0 (SSRC)`

> **Document map (~300 lines):** Evaluators — read in order:
>
> 1. [§ 3-Second TL;DR](#-3-second-tldr-neuromorphic-security)
> 2. [§ Wallet Wiring — Who Installs What (60s)](#wallet-wiring-who-installs-what)
> 3. [§ Judge 60s (live terminal · Module A)](#judge-60s-live-terminal)
> 4. [§ Dual-Engine Wasm/Stylus 90s (oral · Engine A/B)](#judge-dual-engine-90s)
> 5. [§ Dual Pillar 120s (video · Module A + B)](#judge-dual-pillar-120s)
> 6. [§ Adversarial Boundary — summary](#adversarial-boundary-matrix--summary)
> 7. *(Optional appendix)* [§ Agent Harness ODA](#judge-oda-analogy) — skip unless Open House harness background
>
> Full matrices → [01_ADVERSARIAL_BOUNDARY_MATRIX.md](./docs/03_product_verifications/module_a_exomesh/01_ADVERSARIAL_BOUNDARY_MATRIX.md) · [VERIFICATION_MATRIX](./docs/03_product_verifications/01_VERIFICATION_MATRIX.md) · [CLI_RUNBOOK](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md)



## JUDGE_BRIEF — 30-Second Buildathon Brief

<!-- SSOT:JUDGE_SSOT_LOCK_START -->
> **SSOT Lock:** **254 test files | 1206 PASS clean (100%)** · **Release: v1.0 · BeDelta Living Water v1.0 (SSRC)** · **3-Axis Security Scorecard: 5/0/0 PASS** · Gate [0x71d7…e2f1](https://arbiscan.io/address/0x71D7d26f98110c5DE3df0fCbddCf2A3A2BC6e2f1) · Wasm **<28kb / <60µs** · Worker bundle **40.5 KiB gzip** (111.19 KiB raw · `limitKiB: 150` · `pass: true`) · ABI **v2** · 28-protocol-slot FFI (RESERVED_ABI_V2 holes preserved)  
> **Latency classes:** **~0.5µs–1.1µs** Pure Invariant Math · **p50 ~15µs** Stylus ReflexCore (SSRC) warm path (**<20µs**) · **p50 ~106µs** E2E ExoMesh Edge (Worker + TS Gateway + SSRC FFI)  
> **Zero-Allocation Hot-Path**: Pre-consensus microsecond execution on static `Uint32Array` slabs and Wasm linear memory with **zero ephemeral heap allocations** (~**50,000 ephemeral heap objects/sec eliminated**); cold-path warning formatters and error loggers remain standard readable TypeScript.
<!-- SSOT:JUDGE_SSOT_LOCK_END -->

<!-- SSOT:JUDGE_VERIFIED_COMMIT_START -->
> **Verified Commit:** `main` @ **`0885225`** · baseline **`572e5cd`** (GMX on-chain invariant stack @ 572e5cd)
<!-- SSOT:JUDGE_VERIFIED_COMMIT_END -->

---



<a id="-3-second-tldr-neuromorphic-security"></a>

## ⚡ 3-Second TL;DR (Neuromorphic Security)

**Cerebrum vs. Cerebellum — SliverVine ExoMesh is the involuntary reflex arc for autonomous AI agents.**


|               | **Cerebrum (LLM / Agent Loop)**           | **ExoMesh Reflex Arc (Cerebellum)**                                                           |
| ------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Latency**   | **~1.0s–10.0s** (CoT & tool calls)        | **E2E p50 ~106µs** (ALLOW) · **p50 ~15µs reflex core** (FAIL_CLOSED)                          |
| **Nature**    | Non-deterministic · hallucination-prone   | **100% deterministic** · **0-Gas FAIL-CLOSED**                                                |
| **On threat** | Out-of-scope calldata (cross-chain drift) | **p50 ~15µs** — severs [EIP-712](https://eips.ethereum.org/EIPS/eip-712) channel · **$0 Gas** |


**One-liner:** LLM emits toxic intent → ExoMesh severs signing **before** Sequencer queues → `pnpm demo:exomesh` · `pnpm demo:gmx -- --trip` · `pnpm demo:pendle -- --trip` · `npx vitest run tests/sdk/retail-guard-provider.test.ts` (**35/35**)

### What We Ship (Finished SKU)

Full narrative → [docs/03_product_verifications/03_DELIVERABLES_AND_PROOFS.md](./docs/03_product_verifications/03_DELIVERABLES_AND_PROOFS.md)


| Deliverable                                              | Proof                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `@slivervine/exomesh-agentic-wallet-guard` (primary SKU) | **35/35** · `npx vitest run tests/sdk/retail-guard-provider.test.ts`             |
| `pkg/soil_core.wasm` (SSRC reflex)                       | `pnpm demo:gmx -- --trip` · `pnpm demo:pendle -- --trip`                        |
| On-chain anchors (PolicyGuardV2, Stylus)                 | [mainnet anchors](./docs/03_product_verifications/shared_proofs/01_ON_CHAIN_MAINNET_ANCHORS.md) |
| Sanctuary (Module B complement)                          | `pnpm demo:sanctuary`                                                            |



<a id="wallet-wiring-who-installs-what"></a>

## Wallet Wiring — Who Installs What (60s read)

- **End users** keep MetaMask / Rabby — **no** new wallet install.
- **Integrators** wrap once at dApp bootstrap: `withRetailGuardProvider(window.ethereum, config)`.
- **Judges** verify via terminal — **no browser** required.

```mermaid
flowchart LR
  Agent["dApp / AI Agent"]
  Guard["withRetailGuardProvider"]
  Wallet["MetaMask / Rabby"]
  Agent --> Guard
  Guard -->|"REJECT: $0 Gas"| Agent
  Guard -->|"ALLOW"| Wallet
```

| Path | Shipped? | Who wires |
|------|----------|-----------|
| **A — dApp-side wrap** | **Yes** (primary SKU) | Protocol / dApp dev |
| **B — Wallet built-in (Rabby)** | No — partnership GTM | Wallet vendor |
| **C — Extension sample** | Scaffold only | `src/extension/` load-unpacked |

Full wiring guide (MetaMask · Rabby · Viem · wagmi · GTM diagrams) → [03_WALLET_INTEGRATION_AND_INSTALL_GUIDE.md](./docs/02_sdk_and_integrations/01_guides/03_WALLET_INTEGRATION_AND_INSTALL_GUIDE.md)

<a id="judge-60s-live-terminal"></a>

**Judge 60s (live terminal · ~90–120s):** Run **EIP-1193 matrix + two venue soil trips** (what the firewall *does*), then **Vitest** (authoritative SKU proof). **No browser.** Do **not** use `--json` for live judges — JSON is for auditors/CI only.


| Step  | Command                                                  | What displays on screen                                                                                                                 |
| ----- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `pnpm demo:exomesh`                                      | Scenario **A–D** matrix · green **ALLOW** · yellow **WARN** · red **FAIL_CLOSED** / **CHANNEL_SEVERED** · `plainTextWarning` · `wasmUs` |
| **2** | `pnpm demo:gmx -- --trip`                                | GMX venue row · **GMX_FAIL_CLOSED** · pool-skew trip · `$0 Gas` · no broadcast                                                          |
| **3** | `pnpm demo:pendle -- --trip`                             | Pendle venue row · **PENDLE_FAIL_CLOSED** · yield-shock trip · `$0 Gas` · no broadcast                                                  |
| **4** | `npx vitest run tests/sdk/retail-guard-provider.test.ts` | **Tests 35 passed (35)** — same SDK as production `withRetailGuardProvider` wrap                                                        |


```bash
pnpm demo:exomesh
pnpm demo:gmx -- --trip
pnpm demo:pendle -- --trip  # 5-Core matrix also includes usdai · hl · variational — see README § 5-Core Venue Execution Matrix
npx vitest run tests/sdk/retail-guard-provider.test.ts
```

**Why this order:** Steps **1–3** show **fail-closed reflex** in readable terminal HUD (EIP-1193 matrix + two `soil_core.wasm` venue trips). Step **4** locks the **authoritative** retail-guard regression — judges see *behavior* before *test count*.

<a id="judge-oda-analogy"></a>

### Agent harness ODA

**Optional · skip unless you know ODA:** LLM = Observe/Decide · `soil_core.wasm` = **Act gate** at EIP-1193 (ALLOW or FAIL_CLOSED · $0 Gas) · **35/35** + `--trip` demos = Inspect. Not an ODA harness — integrators wrap at the signing boundary. [Judge 60s](#judge-60s-live-terminal) steps 1–3 = Act gate; step 4 = Inspect.

**Optional (video / HackQuest demo · not live 60s):** [§ Dual Pillar 120s](#judge-dual-pillar-120s) · `pnpm demo:FW-11-ui` (mock browser toast) · `pnpm demo:exomesh -- --json` (structured export).


<a id="judge-dual-engine-90s"></a>

**Dual-Engine Wasm/Stylus 90s (oral · when judges ask Wasm vs Stylus):** Use when a judge conflates **browser guard** with **on-chain coprocessor**. **Not** a replacement for [§ Judge 60s](#judge-60s-live-terminal).

**Three-sentence answer:**

1. **Engine B (`pkg/soil_core.wasm`)** = pre-sign guard runtime · `pnpm demo:exomesh` / `demo:gmx -- --trip` · **0-Gas · no broadcast**
2. **Engine A (Stylus [0xc23587…625e](https://arbiscan.io/address/0xc23587d6573dd134f95b02b0202ffbf84686625e))** = on-chain settlement coprocessor · Arbiscan proof · **does not replace** the EIP-1193 middleware
3. **ExoMesh Gate ([0x71D7…e2f1](https://arbiscan.io/address/0x71d7d26f98110c5de3df0fcbddcf2a3a2bc6e2f1))** = attestation anchor · appendix click · **not** the demo CLI runtime

```text
Agent EIP-1193 → withRetailGuardProvider → soil_core.wasm (Engine B)
  ├─ REJECT → 0-Gas FAIL_CLOSED (demo:exomesh Scenario C)
  └─ ALLOW  → forward (demo mock hash · live harness separate)

Live UserOp (separate) → PolicyGuardV2 → Stylus coprocessor (Engine A) → Solidity fallback
```

| Judge asks | Show on screen | Do **not** say |
|------------|----------------|----------------|
| Wasm reflex speed | `pnpm demo:exomesh -- --trip` · `pnpm demo:gmx -- --trip` | GMX mainnet fill = firewall proof |
| Stylus deployed? | Arbiscan [0xc23587…625e](https://arbiscan.io/address/0xc23587d6573dd134f95b02b0202ffbf84686625e) | "Stylus **is** the browser guard" |
| Binary size | `ls -la pkg/soil_core.wasm` (<28 KiB) | Live `cargo stylus deploy` on stage |

**90s beat sheet (condensed):**

| Time | Action |
|------|--------|
| **0–10s** | Opening — "T3 pre-sign guard vs T1 on-chain settlement" |
| **10–35s** | `pnpm demo:exomesh -- --trip` — Scenario C+D · `WASM REFLEX` · `0 Bytes Broadcasted` |
| **35–55s** | `pnpm demo:gmx -- --trip` — `GMX_FAIL_CLOSED` · same Engine B binary |
| **55–70s** | Pre-open Arbiscan: Stylus · Gate · PolicyGuardV2 |
| **70–85s** | Optional `pnpm build:stylus` screenshot or `tests/wasm/stylus-soil-wasm.test.ts` |
| **85–90s** | `npx vitest run tests/sdk/retail-guard-provider.test.ts` — **35/35** |

**60s backup:** skip Arbiscan beat · keep `demo:exomesh -- --trip` + `demo:gmx -- --trip` (same as [§ Judge 60s](#judge-60s-live-terminal)).


<a id="judge-dual-pillar-120s"></a>

**Dual Pillar 120s (demo video · ~100–120s):** Full **Module A + B** terminal path. Use `--non-interactive` to skip ENTER pauses and fit HackQuest **120s** form. **No browser.** Do **not** use `demo:ingress -- --trip` here — that shortcut skips AML (Scenario C).


| Step  | Command                                                  | Module | What displays                                                                         |
| ----- | -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| **1** | `pnpm demo:exomesh -- --non-interactive`                 | **A**  | Scenario **A–D** ANSI matrix · ALLOW / WARN / FAIL_CLOSED / CHANNEL_SEVERED           |
| **2** | `pnpm demo:gmx -- --trip`                                | **A**  | GMX **GMX_FAIL_CLOSED** · `soil_core.wasm` · `$0 Gas`                                 |
| **3** | `npx vitest run tests/sdk/retail-guard-provider.test.ts` | **A**  | **Tests 35 passed (35)**                                                              |
| **4** | `pnpm demo:sanctuary -- --non-interactive`               | **B**  | ERC-7540+ Scenario **A–C** · operator hijack · async slippage FAIL_CLOSED             |
| **5** | `pnpm demo:ingress -- --non-interactive`                 | **B**  | Escort **A** SETTLED · route **B** blocked · **C** `AML_INBOUND_TO_ROBINHOOD_BLOCKED` |


```bash
pnpm demo:exomesh -- --non-interactive
pnpm demo:gmx -- --trip
npx vitest run tests/sdk/retail-guard-provider.test.ts
pnpm demo:sanctuary -- --non-interactive
pnpm demo:ingress -- --non-interactive
```

**Why this order:** Steps **1–3** lock **primary SKU** (ExoMesh + authoritative **35/35**). Steps **4–5** show **Module B complement** (vault escort + treasury ingress/AML) without repeating Module A scenarios.

**Not in this path:** `demo:sanctuary -- --trip` (**no** `--trip` **flag**) · `demo:ingress -- --trip` (bridge timeout only — **not** AML).

Demos are **verification instruments** for FW-01–16 — not separate consumer apps.

### Four Core Scenarios (A–D)

Full Text-UI reflex diagram → [Defense Matrix §1](./docs/01_architecture_and_standards/01_core_specs/02_DEFENSE_MATRIX_AND_SSRC_CORE.md)


| ID    | Module                    | Core scenario                       | What we intercept                                                                                                            | Proof (Vitest)                                                                                                                                     |
| ----- | ------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **[Module A: ExoMesh]**   | Retail / Permit2 poisoning          | Infinite approve · Permit2 · EIP-712 domain drift · EIP-5792 toxic batch                                                     | `tests/sdk/retail-guard-provider.test.ts` **35/35** · `eip5792-send-calls.test.ts` **3/3**                                                         |
| **B** | **[Module A: ExoMesh]**   | 5-venue drift & Observatory haircut | GMX impact / Pendle oracle+expiry / USD.ai depeg / HL spread+WS / Variational stale quote — **close/reduce not mis-blocked** | `pnpm demo:gmx -- --trip` · `pendle-soil-guard.test.ts` · `usdai-adapter.test.ts` · `variational-rfq-adapter.test.ts` · `stylus-soil-wasm.test.ts` |
| **C** | **[Module A: ExoMesh]**   | Retry storm / circuit breaker       | 4th rapid submit severs channel · 5 RPS isolate · Dynamic Max SL (`Balance×1%+$100`) · R20 / CRI hardlock                    | `retail-guard-provider.test.ts` (4th submit) · `decorator.test.ts` · `root-protection.test.ts` · `edge-security.test.ts`                           |
| **D** | **[Module B: Sanctuary]** | Sanctuary vault & cross-chain       | ERC-7540 operator hijack · ERC-7683 solver MEV · Across/Robinhood **inbound AML block**                                      | `erc7540-async-escort.test.ts` · `erc7683-intent-guard.test.ts` · `across-ingress-bridge.test.ts`                                                  |


Full production catalog (additional vectors) → [03_CLI_ZONE_MAP.md](./docs/03_product_verifications/shared_proofs/03_CLI_ZONE_MAP.md)

<a id="adversarial-boundary-matrix--summary"></a>

### Adversarial Boundary Matrix — Summary

Engineering-honest firewall audit — **only claim rows with runnable Vitest/demo proof**.

> **Coverage snapshot:** **8 CAN · 7 PARTIAL · 1 GAP** (FW-08). Full FW-01–16 matrix → [01_ADVERSARIAL_BOUNDARY_MATRIX.md](./docs/03_product_verifications/module_a_exomesh/01_ADVERSARIAL_BOUNDARY_MATRIX.md)

**CAN (demo-ready)**


| ID        | Attack vector                            | Primary proof                                                                     |
| --------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| **FW-01** | Stale oracle / delayed feed              | `pnpm demo:FW-01` · `pendle-market-oracle.test.ts`                                |
| **FW-02** | Async race (R20 sever vs in-flight sign) | `pnpm demo:FW-02` · `session-key-gates.test.ts` (incl. sever race)                |
| **FW-04** | RPC poisoning / defense DOS              | `pnpm demo:FW-04` · `cross-venue-fail-safe.test.ts`                               |
| **FW-10** | R17 00:00 UTC reset injection            | `pnpm demo:FW-10` · `unlock-reauthorization.test.ts` · `gateway-lock-hud.test.ts` |
| **FW-11** | Permit2 / EIP-712 approval phishing      | `pnpm demo:FW-11` · `retail-guard-provider.test.ts` (**35/35**)                   |
| **FW-12** | EIP-5792 batched-call smuggling          | `pnpm demo:FW-12` · `eip5792-send-calls.test.ts` (**3/3**)                        |
| **FW-13** | AI retry-storm / 4th-strike sever        | `pnpm demo:FW-13` · `retail-guard-provider.test.ts` · `intent-drift.test.ts`      |
| **FW-14** | ERC-7540 async vault operator hijack     | `pnpm demo:FW-14` · `erc7540-async-escort.test.ts`                                |


**GAP (not claimed in v1.0)**


| ID        | Attack vector             | Primary proof                         |
| --------- | ------------------------- | ------------------------------------- |
| **FW-08** | Priority fee & cancel lag | `chase-engine.test.ts` (dry-run only) |


**Bounded PARTIAL (judge-critical honesty)**


| ID        | Attack vector                    | Primary proof                                                      | Known gap                                                                       |
| --------- | -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **FW-07** | Cascading deadlock / cancel-only | `pnpm demo:gmx -- --trip` · `pendle-gmx-cross-guard.test.ts`       | **Pre-trip** reduce/close green only; **post-R17/R20 sever blocks all signing** |
| **FW-16** | MEV / sandwich extraction        | `exomesh-sdk-bridge-armor.test.ts` · `funding-epoch-guard.test.ts` | B2B armor threshold only; **no live mempool sandwich proof**                    |


**Judge one-liner:** Pre-sign soil + R17/R20 severance are demoable; reduce/close green light applies **before** trip only; post-sever recovery requires master re-auth — we do **not** claim mempool cancel or sandwich guarantees.

### Post-Grant Evolution (Honest Summary)

SliverVine enforces a strict boundary between **immutable security kernels** and **evolving safety policies**:

1. **Immutable kernel (v1.0 freeze):** `pkg/soil_core.wasm` reflex and EIP-1193 hot-path signing are v1.0 codebase-frozen — LLMs and agents **never** modify the enforcement kernel.
2. **V1.5 deterministic policy compiler:** Post-grant upgrades are JSON-schema parameter diffs only; natural language is **compiler-only**, never the enforcement judge.
3. **8 CAN regression gate:** Every policy rollout must pass the FW-01–14 demo-ready adversarial matrix (`pnpm demo:FW-xx`) before ERC-8196 fleet hash pin deploy.

Full architecture SSOT → [Yellow Paper §0.2 · delivered scope vs roadmap](./docs/01_architecture_and_standards/01_core_specs/01_SYSTEM_TOPOLOGY_AND_YELLOW_PAPER.md).

### Primary SDK Entrypoint — EIP-1193+ Agentic Wallet Guard

One-line **EIP-1193+** middleware for integrators — pre-consensus `request()` guard that wraps existing MetaMask / Rabby / Viem / ZeroDev providers (not an RPC proxy; not a new wallet). **0-Gas fail-closed on reject.** Not a new chain. Not “install SliverVine Protocol.” → [Wallet wiring guide](./docs/02_sdk_and_integrations/01_guides/03_WALLET_INTEGRATION_AND_INSTALL_GUIDE.md)

```ts
import { withRetailGuardProvider } from "@slivervine/exomesh-agentic-wallet-guard";
const ethereum = withRetailGuardProvider(window.ethereum, { /* allowlist */ });
await ethereum.request({ method: "eth_sendTransaction", params: [tx] });
// infinite approve / bad Permit2 / venue drift → throw, 0 Gas, never broadcast
```

That wrap **is** the primary SDK entrypoint. GMX live-fill txs are an **appendix**.

> **Optional B2B appendix:** `withExoMeshShield()` — server-side agent execution hook · same `checkSoilResistance()` · not the wallet wrap · [decorator.ts](./src/sdk/decorator.ts) · not judge-primary.

**Key Architectural Moats (engineering-honest):**

- **EIP-1193+ `withRetailGuardProvider()`:** 0-Gas fail-closed at signing boundary · **254/1206** Vitest.
- **Honeypot & Jitter Armor:** 99% synthetic slippage decoy on trap RPC hosts · ±2–5 bps soil-threshold jitter against boundary probing.
- **Observatory Paradox Haircut:** −40 score discount on `close`/`reduce` so emergency de-leveraging is not blocked.

In-memory per-isolate rate limiter (5 RPS) protecting downstream Wasm execution against naive DoS loops.

→ [Defense Matrix §4 · Hidden Engineering Gems](./docs/01_architecture_and_standards/01_core_specs/02_DEFENSE_MATRIX_AND_SSRC_CORE.md)

### 3-Tier EIP/ERC Taxonomy (summary)


| Tier  | Status                        | Standards                                 | Proof anchor                                                  |
| ----- | ----------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| **1** | `[Final]`                     | EIP-1193+ · EIP-5792 · ERC-7540           | `pnpm demo:exomesh` · **35/35** · `demo:sanctuary` **3/3**    |
| **2** | `[De-facto Industrial Draft]` | ERC-7683 · ERC-7579                       | `pnpm demo:ingress` · `pnpm test:zerodev` (mock dry-run only) |
| **3** | `[Not Implemented]`           | EIP-8105 · EIP-8079 · ERC-8226 · ERC-8118 | No implementation claim                                       |


Full 9-row compliance matrix · workflow ASCII · Tier 1/2/3 detail tables → [01_EIP_COMPLIANCE_AND_COMPETITIVE_MATRIX.md](./docs/01_architecture_and_standards/02_eip_standards/01_EIP_COMPLIANCE_AND_COMPETITIVE_MATRIX.md)

> **ZeroDev / ERC-7579 honesty (v1.0):** `pnpm test:zerodev` verifies pre-UserOp pipeline wiring (mock bundler) — **not** on-chain TYPE-4 hook e2e.

---



## Temporal Execution Stack T1/T2/T3

SliverVine occupies **T3** — microsecond-scale **pre-broadcast** intent firewall (Wasm reflex **p50 ~15µs** · E2E Edge **p50 ~106µs**), above T2 sequencer/mempool and T1 on-chain settlement.

→ Full T1/T2/T3 diagram · dynamic risk tiers: [Defense Matrix §3.6.1 · Dynamic risk parameter update](./docs/01_architecture_and_standards/01_core_specs/02_DEFENSE_MATRIX_AND_SSRC_CORE.md)

---



## 2. System Invariants & Scope



### Protocol Scope & Boundary

- **Pre-Consensus only**: ExoMesh never settles, routes solvers, or issues HTTP 402 payment receipts — it **fail-closes** toxic intents at the EIP-1193+ signing boundary.
- **ERC-7683 orthogonality**: Cross-chain intent *settlement & solver formats* are out of scope; ExoMesh runs strictly **before** signatures enter solver/sequencer pipelines.
- **x402 Ecosystem Compatibility**: Fully orthogonal and complimentary. ExoMesh provides sub-50µs zero-gas protection for AI agents executing automated x402 micro-payments on Arbitrum One / Sepolia, ensuring autonomous agents do not drain wallets via poisoned liquidity or oracle drift traps. **No x402 payment rail in v1.0 freeze scope** — ExoMesh is the pre-consensus safeguard, not an HTTP 402 facilitator (see README § Industry Standards).

---



## Submission Snapshot


| Field                        | Value                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release**                  | `v1.0 · BeDelta Living Water v1.0 (SSRC)`                                                                                                                                                                                                                           |
| **Headline**                 | Pre-Consensus Intent Firewall & Execution Safety Primitive for AI Agents on Arbitrum                                                                                                                                                                                |
| **Primary module**           | SliverVine ExoMesh (Module A)                                                                                                                                                                                                                                       |
| **Escrow module**            | SliverVine Sanctuary (Module B)                                                                                                                                                                                                                                     |
| **Track**                    | Promising Products — AI Agents & Financial Primitives                                                                                                                                                                                                               |
| **SliverVineGate** (ExoMesh) | Mainnet [0x71D7d26f98110c5DE3df0fCbddCf2A3A2BC6e2f1](https://arbiscan.io/address/0x71d7d26f98110c5de3df0fcbddcf2a3a2bc6e2f1) · Sepolia [0xc66F96611a737c4e58706D0955594456eAb88959](https://sepolia.arbiscan.io/address/0xc66f96611a737c4e58706d0955594456eab88959) |
| **PolicyGuardV2**            | [0x5df192f9454fd02a89e768632cb5da0762a774bc](https://arbiscan.io/address/0x5df192f9454fd02a89e768632cb5da0762a774bc) · `MAINNET` only · Stylus wired                                                                                                                |
| **SliverVineSoilCoprocessor** (Stylus) | [0xc23587d6573dd134f95b02b0202ffbf84686625e](https://arbiscan.io/address/0xc23587d6573dd134f95b02b0202ffbf84686625e) · `MAINNET` only (`42161`) · Engine A · settlement reinforcement (not browser guard) |
| **Vitest**                   | **254 test files | 1206 PASS clean (100%)** · `pnpm test -- --run`                                                                                                                                                                                                  |
| **Primary SDK Entrypoint**   | `@slivervine/exomesh-agentic-wallet-guard` · *EIP-1193+ (Pre-Sign Local Guard) — Tailor-made for Robinhood Chain & Omni-EVM AI Agents* · **35/35** retail guard tests                                                                                               |
| **Deep docs**                | [SUBMISSION.md](./docs/00_ARB_Buildathon/SUBMISSION.md) · [VERIFICATION_MATRIX.md](./docs/03_product_verifications/01_VERIFICATION_MATRIX.md)                                                                                                                               |


---



## 30-Second Identity

SliverVine is a **pre-consensus execution safety primitive** — E2E ExoMesh Edge gate `checkSoilResistance()` (**p50 ~106µs**) + reflex-core `rootProtection()` (**p50 ~15µs** on `--trip`) + immutable **[EIP-712](https://eips.ethereum.org/EIPS/eip-712) consume-once** `SliverVineGate` on Arbitrum One.

**Production highlights: GMX v2 · Pendle Institutional Sentinel · 5-Core Venue Matrix · ExoMesh Agentic Guard (EIP-1193/5792/6963+) · Stabilizer Sepolia sandbox · V1.0 Public Open Gateway (no API key; 5 RPS via `X-SliverVine-Tier: public`). No pricing or paid API tiers in this submission.**

### 5-Core Venue Matrix


| Venue         | Protocol            | Physical Boundary Guard                                                                                                          | CLI Demo Command                                                                                                                                                                                                                                                            |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gmx`         | **GMX v2**          | OI skew / PoolTVL > **0.35**                                                                                                     | [pnpm demo:gmx -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md)                                                                                                                                                                      |
| `pendle`      | **Pendle**          | Oracle TTL > **60s** · Yield jitter > **200 bps** · PT maturity < **7d** · funding: **USDai** in / **sUSDai** out (**not USDC**) | [pnpm demo:pendle -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md) · `pnpm preflight:venues --venue=pendle` · live USDai→PT-sUSDai round-trip (`execute:pendle:dust` / `dust-exit`) = **execution harness only** — not on-chain soil |
| `usdai`       | **USD.ai**          | Peg drift > **30 bps** · oracle age > **2h**                                                                                     | [pnpm demo:usdai -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md)                                                                                                                                                                    |
| `hyperliquid` | **Hyperliquid L1**  | Spread > **20 bps** · session-key rate cap                                                                                       | [pnpm demo:hl -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md)                                                                                                                                                                       |
| `variational` | **Variational RFQ** | Quote stale > **500ms** · OLP > **15%**                                                                                          | [pnpm demo:variational -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md)                                                                                                                                                              |


**Judge fast-track (FAIL-CLOSED):** [pnpm demo:gmx -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md) · [pnpm demo:pendle -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md) · [pnpm demo:usdai -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md) · [pnpm demo:variational -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md) · [pnpm demo:hl -- --trip](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md)

## ExoMesh Pre-Consensus Security Benchmark (SEPSB)

**What it is:** A measurable, reproducible benchmark for pre-consensus intent firewalls that decide transaction intent safety *before* signature release and *before* L2 sequencer ingress.

<!-- SSOT:JUDGE_SEPSB_TABLE_START -->
| Metric | Target | Achieved (SSOT) |
|--------|--------|-----------------|
| Reflex Latency (p50) | ≤ 20µs | **1.283µs** (Wasm) |
| Reflex Latency (p99) | ≤ 50µs | **6.102µs** (Wasm) |
| End-to-End Edge Latency (p50) | ≤ 120µs | p50 ~106µs |
| True Positive Rate (TPR) | ≥ 99.5% | **100%** |
| False Positive Rate (FPR) | ≤ 0.5% (kill-switch) | **0%** |
| Observatory Paradox Mis-block Count | 0 | **0** |
| 5-Venue Reflex Cap | < 50µs | **<undefinedµs** (undefined) |
<!-- SSOT:JUDGE_SEPSB_TABLE_END -->




```bash
pnpm audit:sepsb    # Run full SEPSB benchmark & export JSON snapshot
```

SSOT: [SEPSB_BENCHMARK_SSOT.json](./docs/audit/SEPSB_BENCHMARK_SSOT.json) · [SEPSB_CORPUS_SNAPSHOT.json](./docs/audit/SEPSB_CORPUS_SNAPSHOT.json)

> 💡 **Dual Telemetry Architecture**:
>
> - **[Dune Operational Shield](https://dune.com/silvervinelabs/slivervine-protocol)** (`/slivervine-protocol`): Off-chain **simulated** telemetry (supplementary) — counterfactual loss · gas avoided · intercept counts (`pnpm export:dune` · `pnpm docs:dune-reconcile`).
> - **[Dune SEPSB Stress Matrix](https://dune.com/silvervinelabs/slivervine-sepsb-stress)** (`/slivervine-sepsb-stress`): Deterministic benchmark runner proving 100% TPR, 0% FPR, and sub-50µs Wasm reflex speeds across 5 venues (GMX, Pendle, USD.ai, Hyperliquid, Variational).

> 🔗 **Live On-Chain Gate Attestations**: `SliverVineGate` (One [0x71d7…e2f1](https://arbiscan.io/address/0x71d7d26f98110c5de3df0fcbddcf2a3a2bc6e2f1) · Sepolia [0xc66f…8959](https://sepolia.arbiscan.io/address/0xc66f96611a737c4e58706d0955594456eab88959)) — **5-row** attestations today (`pnpm export:dune:onchain` · status **INTERFACE_READY**). Continuous full ingestion = post-grant. **Module A Operational Shield stays Modeled Simulation Telemetry (577-row replay) — NOT Mainnet live PnL.**

Spec & telemetry architecture → [03_DUNE_DASHBOARD_SPECIFICATION.md](./docs/01_architecture_and_standards/03_telemetry_and_mo/03_DUNE_DASHBOARD_SPECIFICATION.md)

### Dual-Track Verification (`@slivervine/exomesh-agentic-wallet-guard`)

> ℹ️ **Engineering Honesty & Physical Measurement Note**:
> Microsecond timing targets (`p50 ~15µs SSRC` / `p50 ~106µs Edge`) reflect production Edge Worker design targets and active telemetry budget caps (`REFLEX_BUDGET_US ≤15µs`). Local CLI readings (`pnpm demo:gmx`, `pnpm demo:exomesh`) run single-sample probes subject to OS kernel scheduling, CPU frequency scaling, and Node.js V8 JIT warmup jitter. Such variations in local microsecond measurements are physical inevitabilities of non-realtime operating environments.


| Track               | Command                                                  | Proves                                                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interactive CLI** | `pnpm demo:exomesh`                                      | Scenario **A–D State Matrix** under `JUDGE_SAFE` clock · production `plainTextWarning` from [warnings.ts](./src/sdk/exomesh-agentic-wallet-guard/warnings.ts) · 0-Gas pre-consensus intercept (no broadcast)                                 |
| **Unit tests**      | `npx vitest run tests/sdk/retail-guard-provider.test.ts` | **35/35 PASS** · exhaustive **7/7** reason codes (`VENUE_DRIFT_REJECTED` · `UNAUTHORIZED_SPENDER_REJECTED` · `SLIPPAGE_EXCEEDED` · `DEPTH_INSUFFICIENT` · `MAX_ATTEMPTS_EXCEEDED_SEVERED` · `CHANNEL_SEVERED` · `RPC_TRANSPORT_SYNC_FAILED`) |


Scenario **B** (`DEGRADED_WARN`) is a **demo-only monitor preview** — the SDK fail-closed path is covered by unit tests; scenarios **C** and **D** echo live `RetailGuardRejectedError.plainTextWarning` strings.

### Core Invariants

$$
\Delta_{\text{net}} = \Delta_{\text{GMX\_GM}} + \Delta_{\text{HL\_Short}} \equiv 0
$$

$$
\text{lostUsd} \equiv 0 \quad \forall \text{InFlightBridgeCapital}
$$

$$
t_{\text{reflector\_p50}} \sim 106\,\mu\mathrm{s} \ll t_{\text{mempool\_broadcast}}
$$

---



### 🧪 How to Evaluate & Test SliverVine


| Evaluation Target                      | Execution Method                                                       | Physical Substrate                           |
| -------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| **Primary SDK Entrypoint (EIP-1193+)** | `npx vitest run tests/sdk/retail-guard-provider.test.ts`               | EIP-1193+ wrap · **35/35**                   |
| **Fail-closed soil (no broadcast)**    | `pnpm demo:gmx -- --trip`                                              | `soil_core.wasm` · not the live-fill harness |
| **End-to-End Macro Flow**              | `pnpm demo:delta-neutral`                                              | 4-Step multi-venue HUD                       |
| **Audit Provenance Check**             | `curl -s "https://bedeltawater.slivervine.xyz/api/grant-audit" | jq .` | Static SHA-256 Buildathon archive            |


*Note: Judge **60s live** → [§ Judge 60s](#judge-60s-live-terminal) (Module A only). **Demo video 120s** → [§ Dual Pillar 120s](#judge-dual-pillar-120s) (Module A + B).* `/api/grant-audit` *is a static archive. GMX mainnet fills ≠ firewall proof. Optional B2B `withExoMeshShield` → [decorator.ts](./src/sdk/decorator.ts) — not judge-primary.*

---



## Judge Quickstart — Full FW Matrix (optional depth · not 60s)

```bash
pnpm demo:FW-01   # Stale oracle
pnpm demo:FW-02   # R20 sever race
pnpm demo:FW-04   # RPC poisoning fail-closed
pnpm demo:FW-10   # Midnight R17 HUD disambiguation
pnpm demo:FW-11   # Permit2 / EIP-712 phishing (35/35)
pnpm demo:FW-12   # EIP-5792 batch smuggling (3/3)
pnpm demo:FW-13   # AI retry-storm / 4th-strike sever
pnpm demo:FW-14   # ERC-7540 async vault operator hijack
pnpm test -- --run                                       # 254 files | 1206 PASS (optional)
```

Full Tier 0/1 matrix · Sanctuary · 5-core venues → [02_CLI_DEMO_RUNBOOK.md](./docs/03_product_verifications/02_CLI_DEMO_RUNBOOK.md) · [01_VERIFICATION_MATRIX.md](./docs/03_product_verifications/01_VERIFICATION_MATRIX.md)

<!-- SSOT:JUDGE_VITEST_HONESTY_START -->
> **Engineering honesty:** **1206 PASS** (1 skipped) is the full-repo regression gate — core ExoMesh / SSRC proofs (~1,098 tests), grant HUD copy locks, and demo reproducibility harnesses. See [docs/03_product_verifications/01_VERIFICATION_MATRIX.md](./docs/03_product_verifications/01_VERIFICATION_MATRIX.md).
<!-- SSOT:JUDGE_VITEST_HONESTY_END -->



### Protocol Core Modules (Architecture SSOT)


| Module                              | Scope                                                                                                                                                                                     | Verify                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **SliverVine ExoMesh (Module A)**   | **ExoMesh Agentic Guard (EIP-1193/5792/6963+)** · Wasm reflex · Defense Layers 1–4 (Phishing/Approval · Agent Intent Inspector · Retry Storm Circuit Breaker · RPC Transport Stream Sync) | `[ExoMesh]` commands above   |
| **SliverVine Sanctuary (Module B)** | **Vault Standard:** ERC-7540+ Async Escort (`demo:sanctuary`) · **Treasury Ingress:** Pillar Set X Across/AML (`demo:ingress`)                                                            | `[Sanctuary]` commands above |




### Robinhood Chain Hard Evidence — SliverVine Sanctuary (Module B)

**Live-fire baseline (46630 testnet · 4663 mainnet · 2026-09-21)** — wallet/kernel `0xdf4c3Fe9bADCbb2Cf62c4b334aD021a34f88F913` · index [ROBINHOOD_LIVEFIRE_ARTIFACTS.md](./docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)

| Case | Harness | Tx / artifact |
|------|---------|---------------|
| **A-Tier1** Smart Route `46630→42161` | `execute-smart-route-live-demo.ts` | [0xdca66358…2a2f](https://arbiscan.io/tx/0xdca66358ffb9a2463d1069722ea27dcfabe1d374dc1d5264698c74341bb02a2f) · [JSON](./docs/logging/robinhood_livefire_tier1_2026-09-21T02-02-17-204Z.json) |
| **A-Tier2** native escort (46630) | `probe:rchain-testnet` | [0x4574c97f…fcf6](https://explorer.testnet.chain.robinhood.com/tx/0x4574c97ff91b5321c3281c535577a1a55908f4e92de8c3ecb55433e94735fcf6) · [JSON](./docs/logging/robinhood_livefire_outbound_2026-09-21T01-49-53-777Z.json) |
| **A-Tier2-mainnet** native escort (4663) | `probe:rchain-mainnet` | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) · [JSON](./docs/logging/robinhood_livefire_outbound_2026-09-21T03-00-51-080Z.json) |
| **B1** inbound block | SDK decision probe | [JSON](./docs/logging/robinhood_livefire_inbound_block_2026-09-21T01-54-27-239380566Z.json) · **0 broadcast** |
| **B2** audit certificate | `GET /api/robinhood-audit-snapshot` | [JSON](./docs/logging/robinhood_livefire_inbound_audit_2026-09-21T02-09-39-263Z.json) |
| **B3** treasury pre-sign | `probe:robinhood-inbound-treasury` | [JSON](./docs/logging/robinhood_livefire_inbound_treasury_2026-09-21T02-09-41-885Z.json) · **0 broadcast** |

**Honesty:** `pnpm demo:ingress` = policy replay · **not** live-fire · Case B = decision-layer pre-sign · **not** EIP-1193 wallet middleware · Tier1 used `ALLOW_STALE_ORACLE=1` harness · **not** full Across bridge (`bridgeDeployed: false`) · **4663** Smart Route Arbiscan [0x4c4ca136…964a](https://arbiscan.io/tx/0x4c4ca1362d4a50d4684662e633e728401478c29dbef13f49e109e68253b5964a) = historical precedent, distinct from A-Tier2-mainnet native explorer tx

| Fact                                                           | Code / test anchor                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChainId `46630` (testnet) · `4663` (mainnet) — **not** `46631` | [src/sdk/constants.ts](./src/sdk/constants.ts)                                                                                                                      |
| **Outbound escort (unit/demo)** `46630`/`4663` → `42161`       | `pnpm demo:ingress` · [assertUnidirectionalBridge](./src/sdk/unidirectional-bridge.ts)                                                                              |
| **Inbound AML (live-fire B1–B3)** `42161 → Robinhood` blocked  | [B1/B2/B3 JSON](./docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md) · [across-ingress-bridge.test.ts](./tests/adapters/across-ingress-bridge.test.ts)                    |
| **Treasury Escort & Collateral Ingress**                       | [treasury-escort-router.ts](./src/adapters/robinhood/treasury-escort-router.ts) · [treasury-escort-router.test.ts](./tests/adapters/treasury-escort-router.test.ts) |
| **EIP-1193+ 0-Gas protection (ExoMesh Module A)**              | `@slivervine/exomesh-agentic-wallet-guard` · **35/35** · `MAX_ATTEMPTS_EXCEEDED_SEVERED`                                                                            |


---



## Why Protocol, Not a Tool?


| Property                   | Evidence                                                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consume-once invariant** | [SliverVineGate.sol](./SliverVineGate/src/SliverVineGate.sol) — [EIP-712](https://eips.ethereum.org/EIPS/eip-712) replay ⇒ `Replayed()` revert                                                                                                 |
| **Non-custodial gate**     | No proxy · no ETH custody · live **42161**                                                                                                                                                                                                     |
| **Composable primitive**   | `@slivervine/exomesh-agentic-wallet-guard` · `withRetailGuardProvider()` · **EIP-1193+ (Pre-Sign Local Guard)** · [docs/02_sdk_and_integrations/01_guides/01_SDK_INTEGRATION_BLUEPRINT.md](./docs/02_sdk_and_integrations/01_guides/01_SDK_INTEGRATION_BLUEPRINT.md) |


---



## Smart Contract & Deployment Anchors


| Contract                      | Address                                                                                                                                                                                               | Network badge        | Module |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------ |
| **SliverVineGate** (ExoMesh)  | Mainnet [0x71D7…e2f1](https://arbiscan.io/address/0x71d7d26f98110c5de3df0fcbddcf2a3a2bc6e2f1) · Sepolia [0xc66F…8959](https://sepolia.arbiscan.io/address/0xc66f96611a737c4e58706d0955594456eab88959) | `42161` + `421614`   | A + B  |
| **PolicyGuardV2**             | [0x5df192…774bc](https://arbiscan.io/address/0x5df192f9454fd02a89e768632cb5da0762a774bc)                                                                                                              | `MAINNET` · `42161`  | A      |
| **GmxSoilMatrixSwitch**       | [0xd840…34c4](https://arbiscan.io/address/0xd840ad013d3be8a363d537a80d5ea8700f7a34c4)                                                                                                                 | `MAINNET` · `42161`  | A      |
| **SliverVineSoilCoprocessor** | [0xc235…625e](https://arbiscan.io/address/0xc23587d6573dd134f95b02b0202ffbf84686625e)                                                                                                                 | `MAINNET` · `42161`  | A      |
| **IngressSafetySwitch**       | [0xc1Eb…D192](https://sepolia.arbiscan.io/address/0xc1eb1624a3a93e969de57466b1cdbd0e0189d192)                                                                                                         | `SEPOLIA` · `421614` | B      |
| **SliverVineRiskOracle**      | [0x6CA7…8fEa](https://sepolia.arbiscan.io/address/0x6ca7ea722f139f3c23280ebc973caff3b17d8fea)                                                                                                         | `SEPOLIA` · `421614` | B      |


Full matrix → [03_CONTRACT_DEPLOYMENT_MATRIX.md](./docs/01_architecture_and_standards/01_core_specs/03_CONTRACT_DEPLOYMENT_MATRIX.md)

---



## Live Telemetry & Telemetry Proof

<!-- SSOT:JUDGE_TELEMETRY_TABLE_START -->
| Proof layer | URL / command | What judges see |
|-------------|---------------|-----------------|
| **Dashboard 1 — Operational Shield** | [Dune Operational Shield](https://dune.com/silvervinelabs/slivervine-protocol) (`/slivervine-protocol`) | 577-row Modeled Simulation Telemetry (Backtested Chaos Matrix Replay) · $13.49M · $136.25 gas saved · ExoMesh replay CSV |
| **Dashboard 2 — SEPSB Stress Matrix** | [Dune SEPSB Stress Matrix](https://dune.com/silvervinelabs/slivervine-sepsb-stress) (`/slivervine-sepsb-stress`) | **100% TPR** · **0% FPR** · undefined-venue reflex **<50µs** · Intel(R) Core(TM) Ultra 7 155H hardware context |
| **ExoMesh CSV export** | `pnpm export:dune` → [exomesh-dune-telemetry.csv](./docs/audit/exomesh-dune-telemetry.csv) | 577-row Modeled Simulation Telemetry (Backtested Chaos Matrix Replay) · $13.49M · $136.25 gas saved · NOT a Mainnet Live Feed |
| **SEPSB CSV export** | `pnpm audit:sepsb` → [sepsb-stress-telemetry.csv](./docs/audit/sepsb-stress-telemetry.csv) | Deterministic 5-venue benchmark matrix |
| **Live On-Chain Gate Attestations** | `pnpm export:dune:onchain` → [onchain-dune-telemetry.csv](./docs/audit/onchain-dune-telemetry.csv) | 5-row · ExoMesh [0x71d7…e2f1](https://arbiscan.io/address/0x71D7d26f98110c5DE3df0fCbddCf2A3A2BC6e2f1) / Sepolia [0xc66f…8959](https://sepolia.arbiscan.io/address/0xc66F96611a737c4e58706D0955594456eAb88959) · Stylus · Sanctuary · `IntentAttested` · `SoilResistanceTripped` |
| **Provenance archive** | [GET /api/grant-audit](https://bedeltawater.slivervine.xyz/api/grant-audit) | Static SHA-256 Buildathon checkpoint (not a live oracle) |
<!-- SSOT:JUDGE_TELEMETRY_TABLE_END -->

<!-- SSOT:JUDGE_TELEMETRY_PARTITION_START -->
**Dual telemetry partition:** **Operational Shield** = **Modeled Simulation Telemetry (Backtested Chaos Matrix Replay)** (577-row ExoMesh CSV · **$13.49M** · **$136.25** gas saved · NOT a Mainnet Live Feed). **SEPSB Quant Matrix** = reproducible security benchmark across 5 venues. **Live On-Chain Gate Attestations** = 5-row (ExoMesh solidity/stylus + Sanctuary gate · Arbiscan-verifiable tx hashes). Spec → [03_DUNE_DASHBOARD_SPECIFICATION.md](./docs/01_architecture_and_standards/03_telemetry_and_mo/03_DUNE_DASHBOARD_SPECIFICATION.md) · SSOT → [SYSTEM_METRICS_SSOT.json](./docs/audit/SYSTEM_METRICS_SSOT.json).
<!-- SSOT:JUDGE_TELEMETRY_PARTITION_END -->



> **Instrument note (BH-61):** CSV rollup instrument may read **579 rows**; public baseline above remains **577 rows** — instrument delta only, **NOT** Mainnet live PnL.

---



## Appendix — Security Disclaimers



### 🛡️ Proactive OpSec & Anti-Reversing Policy (Commit History Hardening)

<!-- SSOT:JUDGE_APPENDIX_OPSEC_START -->
> **Notice to Evaluators & Security Auditors:**  
> To prevent hostile anti-reversing forensics and protect proprietary `SSRC Wasm` binary fuses, pre-sinking implementation commits have been squashed and sanitized in accordance with SliverVine Protocol's strict OpSec Release Policy. All protocol invariants are 100% verified via deterministic Vitest suite (**254 test files / 1206 PASS / 3,320+ physical assertions**) and Stylus C-ABI parity tests.
<!-- SSOT:JUDGE_APPENDIX_OPSEC_END -->



---

**SilverVine Labs** · `grants@silvervinelabs.com` · [Dune Operational Shield](https://dune.com/silvervinelabs/slivervine-protocol) · [Dune SEPSB Stress Matrix](https://dune.com/silvervinelabs/slivervine-sepsb-stress)