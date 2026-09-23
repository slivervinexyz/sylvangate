/**
 * SPDX-License-Identifier: Apache-2.0
 * Pre-compiled venue bit LUT — zero hot-path trim().toLowerCase() alloc.
 */
import { eqAddressLoose } from "./address-compare";

export const RETAIL_UNKNOWN_VENUE_BIT = 1 << 7;

export interface VenueBitEntry {
  readonly addr: string;
  readonly bit: number;
}

export interface VenueBitLut {
  readonly entries: readonly VenueBitEntry[];
}

const LUT_CACHE = new WeakMap<object, VenueBitLut>();

/** Build normalized venue bit LUT at config init (cold path). */
export function compileVenueBitLut(
  contractVenueIndex: Readonly<Record<string, number>>,
): VenueBitLut {
  const keys = Object.keys(contractVenueIndex);
  const entries: VenueBitEntry[] = new Array(keys.length);
  for (let i = 0; i < keys.length; i += 1) {
    const raw = keys[i]!;
    const idx = contractVenueIndex[raw]!;
    entries[i] = {
      addr: raw.trim().toLowerCase(),
      bit: idx >= 0 && idx <= 7 ? 1 << idx : RETAIL_UNKNOWN_VENUE_BIT,
    };
  }
  return { entries };
}

export function getVenueBitLut(
  contractVenueIndex?: Readonly<Record<string, number>>,
): VenueBitLut | null {
  if (!contractVenueIndex) return null;
  const key = contractVenueIndex as object;
  let lut = LUT_CACHE.get(key);
  if (!lut) {
    lut = compileVenueBitLut(contractVenueIndex);
    LUT_CACHE.set(key, lut);
  }
  return lut;
}

/** O(n) scan over pre-compiled entries — n ≈ venue count; zero alloc via eqAddressLoose. */
export function resolveVenueBitFromLut(
  contract: string | undefined,
  lut: VenueBitLut | null,
): number {
  if (!contract?.trim()) return 0;
  if (!lut || lut.entries.length === 0) return RETAIL_UNKNOWN_VENUE_BIT;
  const len = lut.entries.length;
  for (let i = 0; i < len; i += 1) {
    const e = lut.entries[i]!;
    if (eqAddressLoose(contract, e.addr)) return e.bit;
  }
  return RETAIL_UNKNOWN_VENUE_BIT;
}
