/** In-memory Anvil fork — zero mainnet gas for public v0.9 tests. */

export interface AnvilForkState {
  baseFeeWei: bigint;
  blockNumber: number;
}

export class AnvilForkSimulator {
  private state: AnvilForkState = { baseFeeWei: 100_000_000n, blockNumber: 1 };

  getState(): AnvilForkState {
    return { ...this.state };
  }

  async setNextBlockBaseFeePerGas(wei: bigint): Promise<void> {
    this.state = { ...this.state, baseFeeWei: wei, blockNumber: this.state.blockNumber + 1 };
  }

  baseFeeGwei(): number {
    return Number(this.state.baseFeeWei) / 1e9;
  }
}

export function buildRpcJitterRamp(steps: number, minMs = 15, maxMs = 200): number[] {
  if (steps <= 1) return [minMs];
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    out.push(minMs * Math.exp(t * Math.log(maxMs / minMs)));
  }
  return out;
}
