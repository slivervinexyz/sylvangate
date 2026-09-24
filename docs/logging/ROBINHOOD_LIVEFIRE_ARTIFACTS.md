# Robinhood Live-Fire Artifacts (4663 mainnet · 46630 testnet · 2026-09-21)

Public index of judge-facing live-fire evidence. Wallet / kernel: `0xdf4c3Fe9bADCbb2Cf62c4b334aD021a34f88F913`.

| Case | Proof type | On-chain / hash | JSON log | Harness |
|------|------------|-----------------|----------|---------|
| **A-Tier1** | Smart Route UserOp `46630→42161` on **42161** | Tx [0xdca66358…2a2f](https://arbiscan.io/tx/0xdca66358ffb9a2463d1069722ea27dcfabe1d374dc1d5264698c74341bb02a2f) · UserOp `0xd15dbd386a95435e825bf05c0f6186a8b8601bb6ee9071f87f59d41f79416941` | [tier1](./robinhood_livefire_tier1_2026-09-21T02-02-17-204Z.json) | `pnpm tsx scripts/execute-smart-route-live-demo.ts` · `SMART_ROUTE_SOURCE_CHAIN_ID=46630` |
| **A-Tier2** | Robinhood **46630** native escort tx | [0x4574c97f…fcf6](https://explorer.testnet.chain.robinhood.com/tx/0x4574c97ff91b5321c3281c535577a1a55908f4e92de8c3ecb55433e94735fcf6) · UserOp `0x1e5870ce700a5acb05e746e93b66197ce068195b38b5639ea4807b12a5c39563` | [outbound testnet](./robinhood_livefire_outbound_2026-09-21T01-49-53-777Z.json) | `pnpm probe:rchain-testnet` |
| **A-Tier2-mainnet** | Robinhood **4663** native escort tx | [0x02ced821…951d](https://explorer.chain.robinhood.com/tx/0x02ced8215cb1a9f6ec1b82dd39e01536991f278967d63c63dc29bde2ef6d951d) · UserOp `0x9ce020ba389e59aee46e1e3520acf2e48f760a3e76ec1f9ddac74c47c0ecbfea` | [outbound mainnet](./robinhood_livefire_outbound_2026-09-21T03-00-51-080Z.json) | `pnpm probe:rchain-mainnet` |
| **B1** | SDK decision probe · **0 broadcast** | `AML_INBOUND_TO_ROBINHOOD_BLOCKED` | [inbound_block](./robinhood_livefire_inbound_block_2026-09-21T01-54-27-239380566Z.json) | SDK inbound probe |
| **B2** | Audit certificate (local SDK = API SSOT) | `sha256Signature` `c9896689bb638e0f500318b5d96568f75a40dd273b0a10886890ccad520bd9bb` | [inbound_audit](./robinhood_livefire_inbound_audit_2026-09-21T02-09-39-263Z.json) | `buildRobinhoodAuditSnapshot()` · Hero 3 in `pnpm demo:robinhood-sentinel` |
| **B3** | Treasury/agent pre-sign probe · **0 broadcast** | `RWA_YIELD_SOURCE_CHAIN_UNSUPPORTED` on inbound misuse | [inbound_treasury](./robinhood_livefire_inbound_treasury_2026-09-21T02-09-41-885Z.json) | `pnpm probe:robinhood-inbound-treasury` |

**Precedent (keep distinct):** Robinhood **mainnet `4663`** Smart Route tx [0x4c4ca136…964a](https://arbiscan.io/tx/0x4c4ca1362d4a50d4684662e633e728401478c29dbef13f49e109e68253b5964a) — historical Arbiscan UserOp binding, distinct from A-Tier2-mainnet native 4663 explorer tx.

**Honesty footnotes:**

- `pnpm demo:robinhood-sentinel` = policy replay · **not** live-fire proof
- Case B = decision-layer pre-sign · **not** EIP-1193 wallet middleware (B3 treasury path)
- Tier1 soil used `ALLOW_STALE_ORACLE=1` execution harness at run time
- **A-Tier2-mainnet** = stub attestation · `bridgeDeployed: false` · **not** production buffer verified

**Risk feed formatting (decision-only, not shipped UI):**

```
[HYPERDASH-RISK-FEED] chain=46630 | Inbound Airlock ACTIVE | In-Flight $100 | lostUsd=0 | SHA256 Cert: c989668...
```

Derived from B2 `snapshot` fields — see README § Complement — Treasury Escort & Audit Terminal.

**Cross-links:** [README.md](../../README.md) · `pnpm demo:robinhood-sentinel` · `pnpm test`
