/** Optional Fhenix FHE confidential intent envelope — offline predicate only. */
export interface FhenixEncryptedIntent {
  encryptedPayload: string;
  fheThresholdProof: string;
}

export function validateFhenixEncryptedAirlock(intent: FhenixEncryptedIntent): boolean {
  const payload = intent.encryptedPayload;
  const proof = intent.fheThresholdProof;
  if (typeof payload !== "string" || payload.length === 0) return false;
  return typeof proof === "string" && proof.startsWith("0xfhe");
}
