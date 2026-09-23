/** Grant audit v0 telemetry — Sepolia dual-leg proof loader + payload attach (Edge-safe, no fs). */
import type { GrantAuditPayload } from "./grant-audit.types";
import sepoliaProofBundle from "./sepolia-proof.bundle.json";
import {
  buildSepoliaArbiscanTxUrl,
  type SepoliaDualLegProof,
} from "./sepolia-dual-leg-proof.types";

let cachedSepoliaProof: SepoliaDualLegProof | null | undefined;

function parseSepoliaProof(raw: unknown): SepoliaDualLegProof | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<SepoliaDualLegProof>;
  const tx = row.sepoliaTxHash?.trim();
  if (!tx || !/^0x[a-fA-F0-9]{64}$/.test(tx)) return null;
  return {
    schemaVersion: 1,
    network: "arbitrum-sepolia",
    timestamp: row.timestamp ?? new Date().toISOString(),
    sepoliaTxHash: tx,
    latencyMs: Number(row.latencyMs) || 0,
    hlOrderId: String(row.hlOrderId ?? row.hl?.orderId ?? ""),
    arbiscanUrl: row.arbiscanUrl?.trim() || buildSepoliaArbiscanTxUrl(tx),
    gmx: row.gmx as SepoliaDualLegProof["gmx"],
    hl: row.hl as SepoliaDualLegProof["hl"],
  };
}

/** Resolve bundled Sepolia proof (static JSON import — Worker-safe, no filesystem IO). */
export function loadSepoliaDualLegProof(force = false): SepoliaDualLegProof | null {
  if (!force && cachedSepoliaProof !== undefined) return cachedSepoliaProof;
  cachedSepoliaProof = sanitizeSepoliaProofForPublic(parseSepoliaProof(sepoliaProofBundle));
  return cachedSepoliaProof;
}

/** Strip internal encode artifacts from public grant-audit responses. */
export function sanitizeSepoliaProofForPublic(
  proof: SepoliaDualLegProof | null,
): SepoliaDualLegProof | null {
  if (!proof) return null;
  const { depositCalldata: _depositCalldata, ...gmxPublic } = proof.gmx;
  return { ...proof, gmx: { ...gmxPublic, depositCalldata: { redacted: true } } };
}

export function attachSepoliaDualLegProof<T extends GrantAuditPayload>(
  payload: T,
): T & { sepoliaDualLegProof: SepoliaDualLegProof | null } {
  return { ...payload, sepoliaDualLegProof: loadSepoliaDualLegProof() };
}

export function __resetSepoliaDualLegProofCacheForTests(): void {
  cachedSepoliaProof = undefined;
}

export function __setSepoliaDualLegProofCacheForTests(
  proof: SepoliaDualLegProof | null,
): void {
  cachedSepoliaProof = proof;
}
