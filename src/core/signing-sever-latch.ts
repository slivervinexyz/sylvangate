/** O(1) sever generation latch — closes FW-02 check-then-act race without alloc. */

let severGeneration = 0;

export function readSeverGeneration(): number {
  return severGeneration;
}

export function bumpSeverGeneration(): number {
  severGeneration = (severGeneration + 1) >>> 0;
  return severGeneration;
}

export function assertSeverGenerationUnchanged(atEntry: number): void {
  if (atEntry !== severGeneration) {
    throw new Error("SESSION_KEY_SEVER_GENERATION_RACE");
  }
}

/** @internal test reset */
export function __resetSeverGenerationForTests(): void {
  severGeneration = 0;
}
