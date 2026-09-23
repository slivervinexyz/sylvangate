/** Copy live `/api/grant-audit` JSON to clipboard. */
import { buildGrantAuditClientFallbackPayload } from "./grant-audit-client-fallback";
import type { GrantAuditClientPayload } from "./grant-audit-fetch";

export function serializeGrantAuditPayload(
  payload?: GrantAuditClientPayload | null,
): string {
  return JSON.stringify(payload ?? buildGrantAuditClientFallbackPayload(), null, 2);
}

export async function copyGrantAuditPayload(
  payload?: GrantAuditClientPayload | null,
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(serializeGrantAuditPayload(payload));
    return true;
  } catch {
    return false;
  }
}
