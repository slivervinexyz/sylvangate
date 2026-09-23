/** Dual-venue latency label formatter — pure SSOT (no React hooks). */

export interface DualVenueLatencyProbe {
  arbMs: number;
  hlMs: number;
  label: string;
}

export function formatDualVenueLatencyLabel(arbMs: number, hlMs: number): string {
  return `[ Arbitrum RPC: ${arbMs}ms | HL Session WS: ${hlMs}ms ]`;
}
