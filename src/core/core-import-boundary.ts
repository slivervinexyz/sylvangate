/** Machine-verifiable import boundary for `src/core/` layer inversion hygiene. */

export const CORE_FORBIDDEN_IMPORT_PREFIXES: readonly string[] = [
  "../services/",
  "../../services/",
  "../adapters/",
  "../../adapters/",
  "../routes/",
  "../../routes/",
  "../workers/",
  "../../workers/",
];

/** Gateway files — must never import services/adapters/routes directly (orchestration stays in sinks). */
export const CORE_GATEWAY_FILES: readonly string[] = [
  "src/core/state.ts",
  "src/core/risk.ts",
  "src/core/agent-exomesh-guard.ts",
];

/** Documented orchestration sinks — sole `services/` import escape hatch inside core. */
export const CORE_ORCHESTRATION_SINK_ALLOWLIST: readonly string[] = [
  "src/core/risk-engine-soil.ts",
  "src/core/risk-engine-policy.ts",
  "src/core/risk-engine-lib/risk-engine-types.ts",
  "src/core/intent-ledger/flatten-hardlock.ts",
  "src/core/black-swan-guard-lib/black-swan-guard-flatten.ts",
];

/** Pure hot-path modules — zero forbidden-prefix imports (intent ring + wasm ABI SSOT). */
export const CORE_PURE_HOT_PATH_PREFIXES: readonly string[] = [
  "src/core/intent-core",
  "src/core/intent-mandate",
  "src/core/intent-core-ring",
  "src/core/intent-core-buffers",
  "src/core/wasm-intent-ffi",
];

export function isCorePureHotPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return CORE_PURE_HOT_PATH_PREFIXES.some((p) => norm.startsWith(p));
}

export function isCoreOrchestrationSink(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return CORE_ORCHESTRATION_SINK_ALLOWLIST.includes(norm);
}

export function isCoreGatewayFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return CORE_GATEWAY_FILES.includes(norm);
}

export function isForbiddenCoreImport(spec: string): boolean {
  const norm = spec.replace(/\\/g, "/");
  return CORE_FORBIDDEN_IMPORT_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

export function scanCoreSourceImports(
  source: string,
  filePath: string,
): string[] {
  const normPath = filePath.replace(/\\/g, "/");
  const violations: string[] = [];
  const importRe = /from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    const spec = m[1]!;
    if (!isForbiddenCoreImport(spec)) continue;

    if (isCoreOrchestrationSink(normPath)) continue;
    if (isCoreGatewayFile(normPath) || isCorePureHotPath(normPath)) {
      violations.push(`${normPath} -> ${spec}`);
      continue;
    }
    violations.push(`${normPath} -> ${spec}`);
  }
  return violations;
}
