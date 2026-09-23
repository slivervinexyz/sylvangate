#!/usr/bin/env node
/** SliverVine telemetry sidecar — polls upstream health, exposes /health + fail-closed /v1/intent. */
import http from "node:http";

const UPSTREAM =
  process.env.TELEMETRY_UPSTREAM ?? "https://bedeltawater.slivervine.xyz/api/telemetry/health";
const PORT = Number(process.env.SIDECAR_PORT ?? 8080);
const POLL_MS = Number(process.env.SIDECAR_POLL_MS ?? 2000);
const SLO_MS = Number(process.env.SIDECAR_DECISION_SLO_MS ?? 500);

let lastProbe = { ok: false, rttMs: null, at: null, sloTripped: false };

async function probeUpstream() {
  const t0 = performance.now();
  try {
    const res = await fetch(UPSTREAM, {
      cache: "no-store",
      signal: AbortSignal.timeout(SLO_MS),
    });
    const rttMs = Math.round(performance.now() - t0);
    lastProbe = {
      ok: res.ok,
      rttMs,
      at: new Date().toISOString(),
      sloTripped: rttMs > SLO_MS,
    };
  } catch {
    lastProbe = { ok: false, rttMs: null, at: new Date().toISOString(), sloTripped: true };
  }
}

setInterval(() => void probeUpstream(), POLL_MS);
void probeUpstream();

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function sanctuaryBlocked() {
  return !lastProbe.ok || lastProbe.sloTripped;
}

http
  .createServer(async (req, res) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path === "/health" || path === "/api/telemetry/health") {
      const body = JSON.stringify({
        sidecar: "v0.8-preview",
        decisionDeadlineSloMs: SLO_MS,
        probe: lastProbe,
      });
      res.writeHead(lastProbe.ok && !lastProbe.sloTripped ? 200 : 503, {
        "content-type": "application/json",
      });
      res.end(body);
      return;
    }
    if (path === "/v1/intent" && req.method === "POST") {
      const raw = await readBody(req);
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "INVALID_JSON", failClosed: true }));
        return;
      }
      if (sanctuaryBlocked()) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "SANCTUARY_FAIL_CLOSED",
            reason: lastProbe.sloTripped ? "DECISION_SLO_TRIP" : "UPSTREAM_UNHEALTHY",
            probe: lastProbe,
            failClosed: true,
          }),
        );
        return;
      }
      res.writeHead(403, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "INTENT_GATE_FAIL_CLOSED",
          message: "Pre-execution Sanctuary gate — mount @SagaProtected signer before broadcast",
          symbol: payload.symbol ?? null,
          failClosed: true,
        }),
      );
      return;
    }
    res.writeHead(404).end();
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`[sidecar] telemetry daemon listening on :${PORT}`);
  });
