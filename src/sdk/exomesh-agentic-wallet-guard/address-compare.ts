/**
 * SPDX-License-Identifier: Apache-2.0
 * Zero-allocation EVM address comparison — no ephemeral trim().toLowerCase() on hot path.
 */

function trimBounds(s: string): { start: number; end: number } {
  let start = 0;
  let end = s.length;
  while (start < end && s.charCodeAt(start) <= 32) start++;
  while (end > start && s.charCodeAt(end - 1) <= 32) end--;
  return { start, end };
}

function hexCharLower(code: number): number {
  return code >= 65 && code <= 70 ? code + 32 : code;
}

/** Case-insensitive EVM address equality without allocating normalized strings. */
export function eqAddressLoose(a: string, b: string): boolean {
  const ta = trimBounds(a);
  const tb = trimBounds(b);
  const la = ta.end - ta.start;
  const lb = tb.end - tb.start;
  if (la !== lb || la === 0) return false;
  for (let i = 0; i < la; i++) {
    if (hexCharLower(a.charCodeAt(ta.start + i)) !== hexCharLower(b.charCodeAt(tb.start + i))) {
      return false;
    }
  }
  return true;
}

/** Hot-path allowlist membership — zero ephemeral string allocations. */
export function isAddressInAllowlist(
  address: string | undefined,
  allowlist: readonly string[] | undefined,
): boolean {
  if (!address || !allowlist?.length) return false;
  const ta = trimBounds(address);
  if (ta.end - ta.start === 0) return false;
  for (let i = 0; i < allowlist.length; i++) {
    if (eqAddressLoose(address, allowlist[i]!)) return true;
  }
  return false;
}
