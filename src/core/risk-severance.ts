/** Auto R20 severance on protocol / soil bitmask trips. */
import {
  FLAGS_AUTO_SEVER_MASK,
  FLAGS_SEVERED,
} from "./risk-flags";
import { severSigningChannel } from "./state-store";

export function applyAutoSeveranceOnFlags(flags: number): number {
  if (flags !== 0 && (flags & FLAGS_AUTO_SEVER_MASK) !== 0) {
    severSigningChannel();
    return flags | FLAGS_SEVERED;
  }
  return flags;
}

export function applySoilTripSeverance(tripped: boolean): void {
  if (tripped) severSigningChannel();
}
