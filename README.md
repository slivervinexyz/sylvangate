# SliverVine Kernel Escort for Robinhood Chain (Chain ID: 4663)

**Home Chain: Robinhood Chain (4663 / 46630)** — ZeroDev Kernel Account Intent-Gate & Outbound Capital Escort.

Standalone SKU (`@slivervine/robinhood-sentinel-escort`) for the Robinhood Chain reserved slot. Kernel accounts on Robinhood Chain sponsor outbound UserOps toward Arbitrum One (`42161`) under a fail-closed intent gate. Inbound routes are blocked by a **Permissioned Airlock** (chain-id boundary predicate). Pending capital never books phantom loss (`lostUsd ≡ 0`).

## Quick start

```bash
pnpm demo:robinhood-sentinel
pnpm test          # across-ingress-bridge 6/6
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
