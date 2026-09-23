/**
 * RPC chain timestamp high-watermark — holds on block.timestamp regression.
 */
import {
  allocClockWasmHeap,
  clockWasmRpcIngest,
  isClockWasmReady,
} from "../sdk/clock-wasm";

const RPC_SLOT_BLOCK = 0;
const RPC_SLOT_TS_SEC = 1;

export class RpcTimestampWatermark {
  private readonly memoryBuffer = new BigInt64Array(2);
  private wasmRpcState: BigInt64Array | null = null;

  constructor() {
    if (isClockWasmReady()) {
      const heap = allocClockWasmHeap();
      this.wasmRpcState = heap.rpcState;
    }
  }

  ingest(blockNumber: bigint, timestampSec: bigint): {
    readonly ok: boolean;
    readonly regression: boolean;
    readonly heldTimestampSec: bigint;
  } {
    if (this.wasmRpcState && isClockWasmReady()) {
      this.wasmRpcState[0] = this.memoryBuffer[RPC_SLOT_BLOCK];
      this.wasmRpcState[1] = this.memoryBuffer[RPC_SLOT_TS_SEC];
      const result = clockWasmRpcIngest(this.wasmRpcState, blockNumber, timestampSec);
      this.memoryBuffer[RPC_SLOT_BLOCK] = this.wasmRpcState[0];
      this.memoryBuffer[RPC_SLOT_TS_SEC] = this.wasmRpcState[1];
      return result;
    }

    const lastBlock = this.memoryBuffer[RPC_SLOT_BLOCK];
    const lastTs = this.memoryBuffer[RPC_SLOT_TS_SEC];

    if (lastBlock !== 0n && blockNumber > lastBlock && timestampSec < lastTs) {
      return { ok: false, regression: true, heldTimestampSec: lastTs };
    }

    if (lastBlock === 0n || blockNumber >= lastBlock) {
      this.memoryBuffer[RPC_SLOT_BLOCK] = blockNumber;
      if (lastBlock === 0n || timestampSec >= lastTs) {
        this.memoryBuffer[RPC_SLOT_TS_SEC] = timestampSec;
      }
    }

    return {
      ok: true,
      regression: false,
      heldTimestampSec: this.memoryBuffer[RPC_SLOT_TS_SEC],
    };
  }

  reset(): void {
    this.memoryBuffer[RPC_SLOT_BLOCK] = 0n;
    this.memoryBuffer[RPC_SLOT_TS_SEC] = 0n;
    if (this.wasmRpcState) {
      this.wasmRpcState[0] = 0n;
      this.wasmRpcState[1] = 0n;
    }
  }

  viewStateBuffer(): BigInt64Array {
    return this.memoryBuffer;
  }
}
