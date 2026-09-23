# Security Policy — SliverVine Protocol (BeDelta Living Water v1.0 / BeΔ)

> **Vitest SSOT:** 254 test files | 1206 PASS (100% PASS)

**Entity:** SilverVine Labs · **Contact:** `security@silvervinelabs.com`
**Official Site:** [silvervinelabs.com](https://silvervinelabs.com) — Defense Matrix portal
**Grant / audit:** `grants@silvervinelabs.com`

---

## Reporting a Vulnerability

We take security reports seriously. Please **do not** open public GitHub issues for exploitable findings.

1. Email `security@silvervinelabs.com` with:
 - Description and impact
 - Reproduction steps or proof-of-concept
 - Affected commit or deployed version ID (from `wrangler deploy` output)
2. We acknowledge within **72 hours** and aim for an initial assessment within **7 business days**.
3. Coordinate disclosure — we prefer coordinated release before public disclosure.

**Out of scope:** social engineering, physical attacks, third-party venue (GMX / Hyperliquid / Arbitrum) bugs outside our Worker boundary, denial-of-service without exploit chain.

---

## Fail-Closed Security Guarantees

SliverVine ExoMesh is designed **fail-closed** — ambiguous or unsafe states halt signing and broadcast:

| Layer | Module | Guarantee |
|-------|--------|-----------|
| Sequencer Guard | `sequencer-guard.ts` | No dispatch when Arbitrum sequencer unhealthy (600s grace) |
| Oracle Lag Shield | `arbitrum-gas-guard.ts` | HALT when canonical lag exceeds cap (<120ms grant posture) |
| Soil Resistance | `risk-control/soil.ts` | Trade rejected on depth, cross-spread, or slippage fuse breach |
| Root Protection | `rootProtectionService.ts` | Fatal / R17·R20 breach kills hot-key signing pipelines |
| Dynamic Max SL | `effective-max-sl.ts` | Dynamic Account Risk Ceiling (V0.8 Baseline: Equity-Weighted SL; V1.0 Mainnet: Dynamic Adaptive Engine) — deprecated fixed $50 SL forbidden |
| Session Key | `session-key-adapter` | Expired or revoked keys → READ_ONLY_OBSERVER |
| RPC Whitelist | `rpc-whitelist.ts` | External RPC monitored; >500ms latency trips circuit breaker |

**No custody:** Worker holds no user private keys. Session keys are client-scoped; mainnet secrets live in Cloudflare Secrets Store / `wrangler secret` — never in repo or KV.

**KV tenancy:** Single namespace ID with strict key-prefix isolation (`exec:*`, `state:*`, `sys:*`). See `wrangler.toml` comments and [docs/01_architecture_and_standards/README.md](./docs/01_architecture_and_standards/README.md).

**Public audit surface:** `GET /api/grant-audit` exposes guard states and telemetry — never signing material, calldata templates, or proprietary encode paths.

---

## Supported Versions

| Component | Branch / tag | Support |
|-----------|--------------|---------|
| bedelta-living-water Worker | `main` | Active |
| Grant Audit HUD | production deploy | Active |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [docs/01_architecture_and_standards/README.md](./docs/01_architecture_and_standards/README.md) | Topology · R01–R20 · KV isolation |
| [docs/0A_grants/arbitrum/GRANT_PROPOSAL.md](./docs/0A_grants/arbitrum/GRANT_PROPOSAL.md) | Scope & roadmap |
| [docs/README.md](./docs/README.md) | Audience router |
