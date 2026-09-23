/** OpSec import boundary guard for public v0.9 surface. */

export const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /crates\/bme-/,
  /services\/telemetry\/bme-/,
  /grant-v09-risk-sim/,
  /fflash-/,
  /INTERNAL_SECRET/,
];

export const FORBIDDEN_PUBLIC_JSON_KEYS: readonly RegExp[] = [
  /phaseShift/i,
  /deltaHp/i,
  /fci_index/i,
  /hawking/i,
  /eigenvalue/i,
  /^w_\d+$/i,
  /INTERNAL_SECRET/,
  /Formula\s*[1-5]/i,
];

export function assertForbiddenImportPath(importPath: string): void {
  if (FORBIDDEN_IMPORT_PATTERNS.some((re) => re.test(importPath))) {
    throw new Error(`OPSEC_IMPORT_VIOLATION:${importPath}`);
  }
}

export function assertGrantAuditPayloadClean(payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const re of FORBIDDEN_PUBLIC_JSON_KEYS) {
    if (re.test(raw)) throw new Error(`OPSEC_GRANT_AUDIT_LEAK:${re}`);
  }
  if (/\b0\.(72|78|82)\b/.test(raw)) throw new Error("OPSEC_THRESHOLD_LEAK");
}

export function scanSourceForForbiddenImports(source: string, filePath: string): string[] {
  const hits: string[] = [];
  const importRe = /from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    const spec = m[1]!;
    if (FORBIDDEN_IMPORT_PATTERNS.some((re) => re.test(spec))) {
      hits.push(`${filePath} -> ${spec}`);
    }
  }
  return hits;
}
