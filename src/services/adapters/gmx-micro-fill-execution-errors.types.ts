/** GMX micro-fill execution error types. */
export type { GmxFailedTxDiagnostics } from "./gmx-micro-fill-rpc-diagnostics";

export type GmxMicroFillExecutionContext = {
  step: string;
  router?: string;
  owner?: string;
  market?: string;
  collateralRaw?: string;
  collateralUsd?: string;
  executionFeeWei?: string;
  dispatchMode?: string;
  txHash?: string;
  decodedOnChainRevert?: string;
};

export class GmxMicroFillExecutionError extends Error {
  readonly summary: string;
  readonly context: GmxMicroFillExecutionContext;
  readonly cause: unknown;

  constructor(cause: unknown, context: GmxMicroFillExecutionContext, summary: string) {
    super(summary);
    this.name = "GmxMicroFillExecutionError";
    this.summary = summary;
    this.context = context;
    this.cause = cause;
  }
}
