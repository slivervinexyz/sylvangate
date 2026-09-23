/** Auto-detect local benchmark hardware — SSOT metadata for P0 / audit harnesses. */
import os from "node:os";

export interface BenchmarkEnvironment {
  detectedAt: string;
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  cpuModel: string;
  cpuCores: number;
  cpuSpeedMhz: number;
  totalMemoryMb: number;
}

export function detectBenchmarkEnvironment(now = new Date()): BenchmarkEnvironment {
  const cpus = os.cpus();
  const primary = cpus[0];
  return {
    detectedAt: now.toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpuModel: primary?.model?.trim() || "unknown",
    cpuCores: cpus.length,
    cpuSpeedMhz: primary?.speed ?? 0,
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
  };
}
