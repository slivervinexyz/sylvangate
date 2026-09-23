/**
 * POST /api/subscribe — lightweight yield alert email capture (KV, no auth).
 */

import type { Env } from "../env";
import { CORS_JSON_HEADERS } from "../services/config";
import { SUBSCRIBE_SUCCESS_MESSAGE } from "./subscribe.constants";

export { SUBSCRIBE_SUCCESS_MESSAGE } from "./subscribe.constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SubscribeRequestBody {
  email?: string;
  source?: string;
}

export interface SubscribeRecord {
  email: string;
  source: string;
  subscribedAt: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_JSON_HEADERS });
}

export function isValidSubscribeEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

export function fnv1aHex(input: string): string {
  let hash = 2_166_136_261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildSubscribeKvKey(email: string, now = Date.now()): string {
  const normalized = email.trim().toLowerCase();
  return `email:${now}:${fnv1aHex(normalized)}`;
}

function resolveSubscribeKv(env: Env): KVNamespace | undefined {
  return env.SLIVERVINE_KV ?? env.SYSTEM_STATE_KV ?? env.BEDELTA_WATER_KV;
}

/** POST /api/subscribe */
export async function handleSubscribeRequest(
  env: Env,
  request: Request,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let body: SubscribeRequestBody;
  try {
    body = (await request.json()) as SubscribeRequestBody;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const email = String(body.email ?? "").trim();
  if (!isValidSubscribeEmail(email)) {
    return json({ success: false, error: "Invalid email format" }, 422);
  }

  const kv = resolveSubscribeKv(env);
  if (!kv) {
    return json({ success: false, error: "SLIVERVINE_KV binding missing" }, 503);
  }

  const subscribedAt = new Date().toISOString();
  const record: SubscribeRecord = {
    email: email.toLowerCase(),
    source: String(body.source ?? "vault-view").slice(0, 64),
    subscribedAt,
  };
  const key = buildSubscribeKvKey(email);
  await kv.put(key, JSON.stringify(record));

  return json({ success: true, message: SUBSCRIBE_SUCCESS_MESSAGE });
}

export function isSubscribeApiPath(pathname: string): boolean {
  return pathname === "/api/subscribe";
}
