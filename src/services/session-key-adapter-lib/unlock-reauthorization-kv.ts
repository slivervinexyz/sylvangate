/** KV binding for hardlock release — no viem (Worker boot hot path). */
import type { SliverVineKv } from "../kv-lib/keys";

let unlockKvBinding: SliverVineKv | undefined;

export function configureUnlockReauthorizationKv(kv: SliverVineKv | undefined): void {
  unlockKvBinding = kv;
}

export function readUnlockReauthorizationKv(): SliverVineKv | undefined {
  return unlockKvBinding;
}

export function __resetUnlockReauthorizationKvForTests(): void {
  unlockKvBinding = undefined;
}
