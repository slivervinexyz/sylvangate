# Cross-Chain Architecture FAQ — 4663 → 42161

**SKU:** `@slivervine/sylvangate`  
**Audience:** Judges, integrators, red-team reviewers  
**SSOT modules:** `treasury-escort-router.ts` · `treasury-escort-stub.ts` · `rchain-escort-attestation.ts` · `gmx-revenue.ts`

---

## 1. Three-Tier Architecture

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

**Flow:** `4663 → 42161` outbound only · `42161 → 4663` fail-closed · `lostUsd ≡ 0` · Decision layer = **zero-gas** pre-sign (no Cloudflare Worker required).

| Tier | Chain | Role | What actually runs |
|------|-------|------|-------------------|
| **Home** | Robinhood Chain `4663` / `46630` | Kernel Account + UserOp origin | ZeroDev Kernel v3 + EntryPoint 0.7; escort attestation calldata (`SVESC` magic) signed and broadcast **on Robinhood Chain** |
| **Decision** | Off-chain / SDK | Intent gate + route quote | `quoteRChainYieldToArbitrumGm()` · `assertUnidirectionalBridge()` · `buildRobinhoodAuditSnapshot()` — fail-closed policy replay |
| **Destination** | Arbitrum One `42161` | GM pool routing **target** (metadata) | GMX v2 ExchangeRouter (`0x7dE39FF2e232A2203196788d37e234cF8F1b83f1`) · GM market tokens — referenced in quotes as the **planned yield destination**, not called from a single 4663 RPC in A-Tier2 |

### Home Chain — UserOp & `SVESC` Attestation

On Robinhood Chain, live-fire probes broadcast a Kernel UserOp whose calldata encodes an **escort attestation stub**:

```
SVESC (magic) + routeId (32 bytes) + destChainId (4 bytes) + digestStub (32 bytes)
```

- **Source:** `scripts/_shared/rchain-escort-attestation.ts`
- **Live-fire (4663):** [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d)
- **Meaning:** “This Kernel account attests an outbound escort intent toward chain `42161` with routeId `…`.”
- **Does NOT mean:** funds bridged, GMX deposit executed, or SliverVine vault invoked in the same tx.

### Destination Chain — Arbitrum GM Pool (Metadata)

`quoteRChainYieldToArbitrumGm()` attaches destination metadata for the **full intended journey**:

- `destChainId: 42161`
- `smartRoutingAddress` → GMX v2 ExchangeRouter on Arbitrum
- `destMarketToken` → GM pool market token on Arbitrum

These addresses are **existing third-party contracts on Arbitrum**. The quote records where capital is *intended* to land after bridge — they are **routing metadata**, not proof that A-Tier2 executed a GMX call.

### Decision Layer — Unidirectional Gate

| Direction | Policy | Code |
|-----------|--------|------|
| `42161 → 4663` | **Blocked** | `SOURCE_AIRLOCK_INBOUND_BLOCKED` (chain-id predicate) |
| `4663 → 42161` | **Outbound only** | `assertUnidirectionalBridge()` · `lostUsd ≡ 0` |

Bridge partner in ecosystem narrative: **Across** (Robinhood official bridging partner). This SKU implements the **decision state machine** — not a custom bridge deployment.

### Unidirectional Safety Invariant across Any Chain

The Intent-Gate standard is **chain-ID agnostic on inbound** and **parameterized on outbound** — demo evidence uses `42161`, but the SDK interfaces are built for any EVM destination.

| Direction | Invariant | Mechanism |
|-----------|-----------|-----------|
| **Inbound Airlock** | Any unverified capital entering Robinhood Chain → **fail-closed, 0-Gas** | `isInboundToRobinhoodRoute` → `SOURCE_AIRLOCK_INBOUND_BLOCKED`; predicate is `non-Robinhood → Robinhood`, not tied to a specific source chain (`10`, `8453`, `1`, `42161` → `4663` all blocked) |
| **Outbound Escort** | Escorting capital from Robinhood to **any** EVM `destChainId` → `lostUsd ≡ 0` + verifiable SHA-256 state integrity snapshot | `assertUnidirectionalBridge()` · `buildRobinhoodAuditSnapshot()`; `SVESC` attestation encodes `destChainId` as a 4-byte field (see [Home Chain — UserOp & `SVESC` Attestation](#home-chain--userop--svesc-attestation) above) |

**Composed gateway flow:** `checkAirlockThreshold({ chainId: 4663 })` guards the home-chain sign step; outbound routing carries the dynamic `destChainId` through attestation calldata and bridge evaluation — not through the soil input type.

**Current implementation scope:** `isRobinhoodToArbitrumRoute` permits **only** `4663/46630 → 42161` in this spinoff. Omni-Chain describes the Intent-Gate extension surface; per-destination metadata adapters (GM pools, venue routers) for `10` / `8453` / `1` are not shipped here.

**Related:** [README — Omni-Chain Extensibility](../README.md#omni-chain-extensibility)

---

## 1.5 Standards & ERC Boundary

| Category | This SKU **ships / demo** | Inherited / **not shipped** | How to describe |
|----------|---------------------------|-----------------------------|-----------------|
| **ERC-4337** | ZeroDev Kernel v0.3.1 + EntryPoint 0.7 · UserOp path | — | ✅ “Integrates with ZeroDev AA” |
| **ERC-7579** | Kernel modular framing · v4 **readiness types** | On-chain hook pilot | ✅ “Readiness for Kernel v4 Condition Interface” |
| **Application** | SHA-256 audit snapshot · `SVESC` attestation stub | — | ✅ Decision cert — **not** a new ERC |
| **ERC-7540 / 7683 / 8196** | — | Pruned from spinoff | ❌ Not shipped in this SKU |
| **EIP-1193 / 5792** | — | Pruned | ❌ Not wallet middleware |

**Do not claim:** “SliverVine enhanced / superseded ERC-7540+7683” · “EIP-1193 middleware live on 4663”.

---

## 2. `contractDeployed: false` — What It Means

> **`contractDeployed: false` and `bridgeDeployed: false` apply ONLY to SliverVine proprietary contracts** (treasury yield vault, bridge buffer, routing contract with non-zero `verifyingContract`). They do **not** mean “no contracts exist on Robinhood Chain or Arbitrum.”

| Status | Contracts |
|--------|-----------|
| **SliverVine — NOT deployed** (`contractDeployed: false`) | Treasury yield vault · bridge buffer · EIP-712 `verifyingContract: 0x0000…` stub domain (`treasury-escort-stub.ts`) |
| **Third-party — EXISTS natively** | ZeroDev Kernel + EntryPoint 0.7 on `4663`/`46630` · GMX v2 on `42161` · Across bridge infrastructure (ecosystem) |
| **Decision layer — LIVE** (`decisionReady: true`) | Quote, airlock, audit snapshot logic — testable without SliverVine vault deploy |

From `treasury-escort-router.ts` file header:

> *Contracts remain undeployed; routing decisions are fail-closed and testable.*

---

## 3. Flow Diagram — A-Tier2 vs A-Tier1

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    quoteRChainYieldToArbitrumGm()                        │
│         Decision: 4663 source → 42161 destination metadata (GM pool)     │
│         contractDeployed: false  ·  decisionReady: true                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌─────────────────────────────┐           ┌─────────────────────────────┐
│  A-Tier2 — Attestation Probe │           │  A-Tier1 — Smart Route Exec │
│  Chain: 4663 / 46630 (HOME)  │           │  Chain: 42161 (DESTINATION) │
├─────────────────────────────┤           ├─────────────────────────────┤
│  UserOp on RH explorer       │           │  UserOp on Arbiscan         │
│  Calldata: SVESC stub        │           │  GMX smart-route execution  │
│  bridgeDeployed: false       │           │  Full cross-chain exec tier │
│  Proves: intent attestation  │           │  Proves: dest-chain UserOp  │
│  Does NOT prove: bridge+GMX  │           │  Source: 46630 → 42161      │
└─────────────────────────────┘           └─────────────────────────────┘
         │                                           │
         ▼                                           ▼
  explorer.chain.robinhood.com              arbiscan.io/tx/0xdca66358…
  tx 0x02ced821…951d (mainnet)              (A-Tier1 live-fire)
```

### Live-fire index

| Case | Explorer | Proof scope |
|------|----------|-------------|
| **A-Tier2-mainnet** | [4663 tx](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) | Home-chain attestation only |
| **A-Tier2** | [46630 tx](https://explorer.testnet.chain.robinhood.com/tx/0x4574c97ff91b5321c3281c535577a1a55908f4e92de8c3ecb55433e94735fcf6) | Home-chain attestation (testnet) |
| **A-Tier1** | [42161 tx](https://arbiscan.io/tx/0xdca66358ffb9a2463d1069722ea27dcfabe1d374dc1d5264698c74341bb02a2f) | Destination-chain smart-route execution |

Full artifact table: [docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md](./logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)

---

## 4. Judge Pitching — What to Say / What NOT to Say

| ❌ Do NOT say | ✅ Do say |
|--------------|----------|
| “We call GMX directly from Robinhood Chain in one tx.” | “Escort **intent** is attested on `4663`; yield **destination** metadata points to GM pools on `42161`.” |
| “`contractDeployed: false` means no contracts on chain.” | “**SliverVine vault/buffer contracts** are not deployed; ZeroDev Kernel, GMX, and Across exist as third-party infrastructure.” |
| “A-Tier2 proves funds reached GMX.” | “A-Tier2 proves a **4663 Kernel UserOp attestation** (`SVESC`); `bridgeDeployed: false` — not a verified production bridge buffer.” |
| “We built our own bridge.” | “Route aligns with **Across** (official Robinhood bridge partner); this SKU is the **decision gate + audit layer**.” |
| “Inbound block = regulatory scanner.” | “Inbound `42161→4663` is fail-closed by **source airlock / origin integrity predicate** (`SOURCE_AIRLOCK_INBOUND_BLOCKED`).” |
| “`pnpm demo:robinhood-sentinel` re-broadcasts live-fire txs.” | “Demo is **policy replay** — references archived evidence, does not re-broadcast.” |
| “B1/B2/B3 are live wallet middleware.” | “Case B probes are **SDK decision-layer** artifacts with **0 broadcast** (except archived harness runs).” |

---

## 5. Quick Reference

```bash
pnpm demo:robinhood-sentinel    # Scenario 1–3 policy replay (no re-broadcast)
pnpm probe:rchain-mainnet       # A-Tier2-mainnet harness (armed mode only)
pnpm test                       # 14 files · 55/55 PASS
```

**Related public docs:** [README.md](../README.md) · [Omni-Chain Extensibility](../README.md#-omni-chain-extensibility-any-chain-escort) · [ROBINHOOD_LIVEFIRE_ARTIFACTS.md](./logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md)
