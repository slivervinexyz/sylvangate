import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Hex } from "viem";
import { normalizePrivateKey } from "./gate-broadcast-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ENV_PRODUCTION_PATH = join(__dirname, "../../.env.production");
export const LOCAL_ENV_PATH = join(__dirname, "../../.env");

/** Wallet A / mainnet broadcast PK lookup order (SSOT). */
export const MAINNET_PRIVATE_KEY_ENV_KEYS = [
  "MAINNET_PK",
  "WALLET_A_PK",
  "WALLET_A_PRIVATE_KEY",
  "WalletA_Pkey",
  "PRIVATE_KEY",
] as const;

/** ZeroDev Kernel v3 project id lookup order (SSOT). */
export const ZERODEV_PROJECT_ID_ENV_KEYS = [
  "ZERODEV_PROJECT_ID",
  "ZeroDev_projectId",
] as const;

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    out[key] = stripEnvQuotes(line.slice(eq + 1));
  }
  return out;
}

function stripEnvQuotes(value: string): string {
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

export function envProductionExists(): boolean {
  return existsSync(ENV_PRODUCTION_PATH);
}

export function loadEnvProduction(): void {
  if (!envProductionExists()) {
    throw new Error(`.env.production missing — run setup first`);
  }
  applyEnvRecord(parseEnvFile(ENV_PRODUCTION_PATH), true);
}

/** Load `.env` then `.env.production` without overriding shell exports. */
export function loadMainnetEnv(): void {
  const merged: Record<string, string> = {};
  for (const path of [LOCAL_ENV_PATH, ENV_PRODUCTION_PATH]) {
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnvFile(path))) {
      const prior = merged[key];
      if (prior === undefined || prior === "" || value !== "") merged[key] = value;
    }
  }
  applyEnvRecord(merged, false);
}

function applyEnvRecord(record: Record<string, string>, force: boolean): void {
  for (const [key, value] of Object.entries(record)) {
    if (force || process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

/** Resolve ZeroDev project id from env (supports ZeroDev_projectId alias). */
export function resolveZeroDevProjectId(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | null {
  for (const key of ZERODEV_PROJECT_ID_ENV_KEYS) {
    const id = stripEnvQuotes(env[key] ?? "").trim();
    if (id) return id;
  }
  return null;
}

export function isForceEoaFallbackActive(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const v = stripEnvQuotes(env.FORCE_EOA_FALLBACK ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Resolve Wallet A / mainnet signing key from env (supports WalletA_Pkey alias). */
export function resolveMainnetPrivateKey(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Hex {
  for (const key of MAINNET_PRIVATE_KEY_ENV_KEYS) {
    const pk = normalizePrivateKey(stripEnvQuotes(env[key] ?? ""));
    if (pk) return pk;
  }
  throw new Error(`${MAINNET_PRIVATE_KEY_ENV_KEYS.join(" | ")} required (never commit)`);
}

export function mask(value: string): string {
  if (value.length < 12) return "***";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function maskHex(value: string): string {
  return mask(value);
}

export function requireEnv(key: string): string {
  const v = (process.env[key] ?? "").trim();
  if (!v) throw new Error(`${key} missing in .env.production`);
  return v;
}
