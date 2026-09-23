/** Module-load soil reason scratch pool — globalThis SSOT survives duplicate Vitest module graphs. */

export interface SoilReasonScratch {
  flags: number;
  /** Protocol bitmask OR lane — bits 18–19 USD.ai · variational · morpho SSOT. */
  protocolMask: number;
  /** Lazily allocated — null until a composite sub-gate trips. */
  external: string[] | null;
}

type SoilReasonScratchGlobal = typeof globalThis & {
  __exomeshSoilReasonScratch?: SoilReasonScratch;
};

const g = globalThis as SoilReasonScratchGlobal;

function allocSoilReasonScratch(): SoilReasonScratch {
  return { flags: 0, protocolMask: 0, external: null };
}

/** Borrow pre-allocated scratch — reset in-place, zero per-call object alloc on hot path. */
export function borrowSoilReasonScratch(initialFlags = 0): SoilReasonScratch {
  const scratch =
    g.__exomeshSoilReasonScratch ?? (g.__exomeshSoilReasonScratch = allocSoilReasonScratch());
  scratch.flags = initialFlags;
  scratch.protocolMask = 0;
  scratch.external = null;
  return scratch;
}

/** Test isolation — clears global singleton. */
export function __resetSoilReasonScratchPoolForTests(): void {
  delete g.__exomeshSoilReasonScratch;
}
