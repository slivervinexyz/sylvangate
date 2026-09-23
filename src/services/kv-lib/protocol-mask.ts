/**
 * Cross-isolate protocolMask sync — KV adapter shell (SSOT: core/protocol-mask-sync).
 */
import {
  PROTOCOL_MASK_KV_KEY,
  PROTOCOL_MASK_KV_TTL_SECONDS,
  bindProtocolMaskKvPort,
  prefetchProtocolMaskKv as prefetchProtocolMaskKvCore,
  readProtocolMaskSync,
  mergeProtocolMaskLocal,
  scheduleProtocolMaskKvWrite,
  __resetProtocolMaskSyncForTests,
} from "../../core/protocol-mask-sync";
import { KV_KEYS, KV_TTL_SECONDS, resolveKv, type SliverVineKv } from "./keys";

export {
  readProtocolMaskSync,
  mergeProtocolMaskLocal,
  scheduleProtocolMaskKvWrite,
};

function toPort(kv: NonNullable<SliverVineKv>) {
  return {
    getMaskRecord: () => kv.get(KV_KEYS.PROTOCOL_MASK),
    putMaskRecord: (serialized: string) =>
      kv.put(KV_KEYS.PROTOCOL_MASK, serialized, {
        expirationTtl: KV_TTL_SECONDS.SYSTEM_STATE,
      }),
  };
}

export function bindProtocolMaskKv(kv?: SliverVineKv): void {
  const binding = resolveKv(kv);
  bindProtocolMaskKvPort(binding ? toPort(binding) : undefined);
}

export async function prefetchProtocolMaskKv(kv?: SliverVineKv): Promise<number> {
  if (kv !== undefined) bindProtocolMaskKv(kv);
  return prefetchProtocolMaskKvCore();
}

export function __resetProtocolMaskKvForTests(): void {
  __resetProtocolMaskSyncForTests();
}

export { PROTOCOL_MASK_KV_KEY, PROTOCOL_MASK_KV_TTL_SECONDS };
