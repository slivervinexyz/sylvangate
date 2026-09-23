# SliverVine Sanctuary Gate — SliverVine Protocol (BeDelta Living Water v1.0 / BeΔ)

> **Vitest SSOT:** 252 test files | 1190 PASS clean (100%)

On-chain enforcement layer for the BeDelta Living Water / SliverVine pre-execution risk engine (BeDelta Living Water v1.0 · SSRC).

The off-chain engine already decides whether an order is safe. This repo makes that decision
**binding**: if the engine did not sign an ALLOW for *this exact payload*, from *this exact
initiator*, within the last 30 seconds, the transaction does not execute.

Zero external dependencies. Inline ECDSA. Nothing to upgrade, no proxy, no admin function that can
loosen anything without a timelock.

---

## Quick verification

```bash
forge test # 60 tests, 0 failures
forge coverage # 95.51% lines overall
FOUNDRY_PROFILE=deep forge test --match-path test/SliverVineGate.fuzz.t.sol
 # 5 properties x 65,535 runs
forge test --gas-report
```

Verified with forge 1.7.1 / solc 0.8.28 / optimizer 20,000 runs.

| Measurement | Value |
|---|---|
| Tests | 60 passed, 0 failed |
| Line coverage — `SliverVineGate.sol` | 95.65% (132/138) |
| Line coverage — overall | 95.51% (255/267) |
| Property runs | 5 × 65,535 = 327,675 executions, all green |
| Invariant calls | 3 × 16,384 = 49,152 calls, no counterexample |
| `verifyAndConsume` gas (2-of-3) | 25,853 min / 28,055 median |
| `SliverVineGate` runtime size | 10,216 bytes |
| External dependencies | 0 |

## Contracts

| Contract | Role |
|---|---|
| `SliverVineGate.sol` | EIP-712 m-of-n attestation verifier. Single-use digests, 30s max TTL, halt/timelock authority model. |
| `GatedExecutor.sol` | Binds an ALLOW to one payload + one initiator + one target, then performs the call. `tryExecute` soft-denies and emits `GateDenied` so refusals are observable on-chain. |
| `interfaces/ISliverVineGate.sol` | Attestation struct + external surface. |

## Design decisions worth reading the code for

- **chainId is inside the EIP-712 domain**, so the same CREATE2 address can be deployed to
 Robinhood Chain (46630) and Arbitrum Sepolia (421614) with no cross-chain replay risk.
 Proven by `test_CrossChainReplay_Impossible`.
- **Duplicate-signer bypass is unrepresentable**, not merely detected: recovered addresses must be
 strictly ascending.
- **Strict ECDSA**: `v ∈ {27, 28}` with no normalisation, `s ≤ n/2`, `r ≠ 0`. Malleability rejection
 is tested by actually constructing the flipped signature.
- **Authority is deliberately asymmetric**: halt is immediate, every loosening action is timelocked
 and cancellable. A safety device should be easy to close and hard to open.
- **Only `block.timestamp` is used for timing.** On Arbitrum, `block.number` returns an approximate
 *L1* height; the L2 height requires `ArbSys(0x64).arbBlockNumber()`.
- **`checkAttestation` returns the same error selector** the mutating path would revert with, so the
 off-chain engine can pre-flight a decision and get an identical reason code.
- **Digests are marked consumed before the external call** (checks-effects-interactions), on top of
 the reentrancy lock — two independent defences, both asserted in `test_Reentrancy_Blocked`.

## Layout

```
src/ SliverVineGate.sol, GatedExecutor.sol, interfaces/
test/ unit (I1-I12) · fuzz (properties) · invariant (handler) · GatedExecutor · helpers/
script/ Deploy.s.sol — deterministic dual-chain CREATE2 deployment
```

## On-Chain Anchors (SSOT)

| Contract | Address | Explorer |
|----------|---------|----------|
| **SliverVineGate** (ExoMesh · `42161`) | `0x71D7d26f98110c5DE3df0fCbddCf2A3A2BC6e2f1` | [Arbitrum One](https://arbiscan.io/address/0x71d7d26f98110c5de3df0fcbddcf2a3a2bc6e2f1) |
| **SliverVineGate** (ExoMesh · `421614`) | `0xc66F96611a737c4e58706D0955594456eAb88959` | [Sepolia](https://sepolia.arbiscan.io/address/0xc66f96611a737c4e58706d0955594456eab88959) |

Full matrix → [`02_CONTRACT_DEPLOYMENT_MATRIX.md`](../docs/01_architecture_and_standards/01_core_specs/03_CONTRACT_DEPLOYMENT_MATRIX.md) · legacy → [`03_SUPERSEDED_DEPLOYMENTS_APPENDIX.md`](../docs/01_architecture_and_standards/01_core_specs/05_SUPERSEDED_DEPLOYMENTS_APPENDIX.md)

## Deployment

```bash
export PRIVATE_KEY=... GATE_SIGNERS=0x..,0x..,0x.. # ASCENDING order, enforced
export GATE_THRESHOLD=2 GUARDIAN=0x.. GATE_ADMIN=0x.. EXEC_TARGETS=0x.. SALT=0x..

forge script script/Deploy.s.sol:Deploy --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.chain.robinhood.com --broadcast
```

Both runs must print the same addresses. Record them, plus each chain's `domainSeparator()`, in
[`02_CONTRACT_DEPLOYMENT_MATRIX.md`](../docs/01_architecture_and_standards/01_core_specs/03_CONTRACT_DEPLOYMENT_MATRIX.md).

## Status

See [SUBMISSION.md](../docs/00_ARB_Buildathon/SUBMISSION.md) for full grant milestones. M0–M2 complete and measurable; M3–M6 (deployment, engine
integration, public demo) are the committed remaining work.
