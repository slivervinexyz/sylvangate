# SliverVine Protocol (BeDelta Living Water v1.0 / BeΔ) — Sanctuary Telemetry Sidecar

> **License:** BUSL-1.1 (Business Source License 1.1) · Copyright (c) 2026 SilverVine Labs

> B2B Zero-Allocation Hot-Path relay for Grant evaluators · polls live ExoMesh telemetry · exposes local `/health` + fail-closed `/v1/intent`.

> **Doc log (2026-08-25):** Tier-0 root [`Dockerfile`](../Dockerfile) E2E · Sidecar Tier-5 · R03/R04 RTT 200/500ms · 5-TX provenance SSOT.

**Entity:** SilverVine Labs · **Official Site:** [silvervinelabs.com](https://silvervinelabs.com) · **Upstream:** `https://bedeltawater.slivervine.xyz/api/telemetry/health`
**Regression bar: 248 test files | 1156 PASS clean (100%)**

---

## 0. Path 2 — Root E2E Verifier (Isolated Docker)

> **Fastest path:** see root README **Path 1** (`pnpm install && pnpm run demo:delta-neutral`) — ~3 seconds with host Node/pnpm.

From repository root — **not** the sidecar image:

```bash
docker build -t slivervine-sanctuary . && docker run --rm slivervine-sanctuary
```

> **WSL2 / Linux User Note:** If executing Docker directly inside WSL2 without Docker Desktop integration, run commands with `sudo` (e.g., `sudo docker build -t slivervine-sanctuary . && sudo docker run --rm slivervine-sanctuary`), or leverage **Path 1 (`pnpm run demo:delta-neutral`)** for instant 3-second host verification without containers.

| Item | Value |
|------|-------|
| Dockerfile | [`../Dockerfile`](../Dockerfile) (repo root) |
| Default CMD | `pnpm run demo:delta-neutral` → `[tier0] demo:delta-neutral PASS` |
| Full Vitest bar | `docker run --rm slivervine-sanctuary pnpm test` → **248 test files | 1156 PASS clean (100%)** |
| Isolation | No host Node 22 / pnpm / WSL required |

Sidecar telemetry (Ops Zone) remains [`Dockerfile.sidecar`](./Dockerfile.sidecar) below.

---

## 0.1 R03 / R04 — RTT & Execution-Lag Telemetry

| Guard | Budget | SSOT |
|-------|--------|------|
| **R04 PGATE** | **200ms** fail-closed | `PGATE_MAX_LATENCY_MS` |
| **R03 HL L2 stale** | **500ms** fail-closed | `HL_L2_STALE_THRESHOLD_MS` |
| Sidecar SLO | **500ms** decision deadline | `SIDECAR_DECISION_SLO_MS` |

**Provenance:** 5 HL testnet fills — [`../src/data/verified_5tx_results.json`](../src/data/verified_5tx_results.json) · grant bundle [`provenance_verified_trades.json`](../src/data/provenance_verified_trades.json). Cross-venue RTT band **~180–320ms** · delta decay **&lt;0.12%** (`crossVenueSlippage: 0.0004`).

---

## 1. Prerequisites


| Requirement | Notes |
| -------------- | ---------------------------------------------- |
| Docker 24+ | Or Node 22+ for native daemon |
| Network egress | Sidecar polls production telemetry (read-only) |
| Port `8080` | Default bind · override via `SIDECAR_PORT` |


---



## 2. Build Image

From repository root:

```bash
docker build -t silvervine-sidecar -f docker/Dockerfile.sidecar .
```


| Flag | Value |
| ---------- | --------------------------- |
| Image tag | `silvervine-sidecar` |
| Dockerfile | `docker/Dockerfile.sidecar` |
| Context | `.` (repo root) |


---



## 3. Run Container

```bash
docker run -d --name sv-sidecar -p 8080:8080 silvervine-sidecar
```

Optional env overrides:

```bash
docker run -d --name sv-sidecar -p 8080:8080 \
 -e SIDECAR_PORT=8080 \
 -e SIDECAR_DECISION_SLO_MS=500 \
 -e TELEMETRY_UPSTREAM=https://bedeltawater.slivervine.xyz/api/telemetry/health \
 silvervine-sidecar
```

Stop / remove:

```bash
docker stop sv-sidecar && docker rm sv-sidecar
```

---



## 4. Verification Testlist for Express Auditors

Run after container starts (~5s warm-up).

### 4.1 Health probe (expect HTTP 200 or 503 JSON)

```bash
curl -sS -w "\nHTTP %{http_code}\n" http://localhost:8080/health | jq .
```

**Pass criteria:**

- JSON includes `sidecar`, `decisionDeadlineSloMs`, `probe`
- `probe.ok === true` → HTTP **200**
- Upstream unreachable → HTTP **503** (still JSON, fail-closed armed)



### 4.2 Fail-closed intent gate (expect HTTP 403)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
 -X POST http://localhost:8080/v1/intent \
 -H 'Content-Type: application/json' \
 -d '{"symbol":"ETH","side":"long","sizeUsd":100}' | jq .
```

**Pass criteria:**

- HTTP **403**
- `failClosed: true`
- `error` is `SANCTUARY_FAIL_CLOSED` (upstream/SLO trip) or `INTENT_GATE_FAIL_CLOSED` (Sanctuary pre-execution gate)



### 4.3 Invalid JSON (expect HTTP 400)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
 -X POST http://localhost:8080/v1/intent \
 -H 'Content-Type: application/json' \
 -d 'not-json'
```

**Pass criteria:** HTTP **400** · `INVALID_JSON`

### 4.4 One-liner smoke (30-second check)

```bash
curl -sf http://localhost:8080/health | jq -r .sidecar && \
curl -s -o /dev/null -w "intent=%{http_code}\n" -X POST http://localhost:8080/v1/intent -H 'Content-Type: application/json' -d '{}'
```

Expected: `v0.8-preview` then `intent=403`

---



## 5. Native Node (No Docker)

```bash
export SIDECAR_PORT=8080
node docker/sidecar-daemon.mjs
```

Same curl commands against `http://localhost:8080`.

---



## 6. B2B Circuit Breaker Wiring


| Endpoint | Role |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `GET /health` | Liveness · mirrors upstream Sanctuary telemetry RTT |
| `POST /v1/intent` | Pre-execution gate stub — always fail-closed until `@SagaProtected` signer mounted |
| `SIDECAR_DECISION_SLO_MS=500` | **500ms** local Sidecar decision SLO (RTT to `/health`) |
| On-chain RPC | **3000ms** network timeout — fail-closed (no synthetic market depth) |


Institutional funds route alpha through `silvervine-proxy` at `localhost:8080` — existing Python/TS strategies unchanged.

---



## 7. Troubleshooting


| Symptom | Fix |
| ------------------------------- | ------------------------------------------ |
| `connection refused` on `:8080` | `docker ps` · confirm `-p 8080:8080` |
| Health HTTP 503 | Upstream blocked — check egress / VPN |
| Build fails `COPY` | Run `docker build` from repo root |
| Port clash | `docker run -p 9090:8080` and curl `:9090` |


---



## 8. Related Paths


| File | Purpose |
| -------------------------------------------------- | ----------------------------------------- |
| [`../Dockerfile`](../Dockerfile) | **Tier-0** isolated E2E verifier image |
| [`Dockerfile.sidecar`](./Dockerfile.sidecar) | Tier-5 telemetry sidecar image |
| [`sidecar-daemon.mjs`](./sidecar-daemon.mjs) | Edge-safe daemon (no TS runtime) |
| [Root README.md](../README.md) | Sanctuary Core Architecture & Quickstart |
| [docs/0A_grants/arbitrum/GRANT_PROPOSAL.md](../docs/0A_grants/arbitrum/GRANT_PROPOSAL.md) | Full Sanctuary scope |
| [docs/README.md](../docs/README.md) | Docs audience index |


---



## 9. GMX Payload CLI (Grant Evaluators)

```bash
npx tsx scripts/test-gmx-v2-execution.ts --help
npx tsx scripts/test-gmx-v2-execution.ts --live-read [--allow-stale-oracle]
```

Default enforces **30s Oracle Lag fail-closed** Sanctuary gate. `--allow-stale-oracle` bypasses oracle lag deadlock for dry-run payload inspection only (see [README.md](../README.md) Auditor CLI).

---

**License:** BUSL-1.1 (Business Source License 1.1) · Copyright (c) 2026 SilverVine Labs · Grant evaluators retain full review rights. See [LICENSE](../LICENSE).