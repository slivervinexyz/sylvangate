import type { SessionKeyOrderPayload } from "../session-key-adapter";

export function deterministicFillId(payload: SessionKeyOrderPayload): string {
  const seed = `${payload.asset}|${payload.limitPx}|${payload.sz}|${payload.isBuy ? 1 : 0}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `hl-dry-fill-${hash.toString(16).padStart(8, "0")}`;
}

export function deterministicCancelId(orderId: string): string {
  return `hl-dry-cancel-${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
}
