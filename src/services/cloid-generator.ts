/**
 * Root 14 — lightweight Worker-native Client Order ID (CLOID) generator.
 * Produces 128-bit Hyperliquid-compatible hex IDs using Web Crypto only.
 */

export const CLOID_STRATEGY_PREFIX = "STM" as const;
export const CLOID_TAGGED_PREFIX = "STM-" as const;
export const CLOID_HEX_PREFIX = "0x" as const;
export const CLOID_HEX_BODY_LENGTH = 32 as const;

export interface CloidGenerateInput {
  /** Strategy tag embedded in the CLOID payload (default: STM) */
  strategy?: string;
  /** UTC anchor for timestamp embedding */
  now?: Date;
  /** Optional 32-bit nonce — auto-generated via Web Crypto when omitted */
  nonce?: number;
}

export interface GeneratedCloid {
  /** Hyperliquid 128-bit hex cloid: 0x + 32 lowercase hex chars */
  hex: string;
  /** Human tag: STM-YYYYMMDDHHmmss-<8 hex nonce> */
  tagged: string;
  strategy: string;
  utcTimestampMs: number;
  nonce: number;
}

function randomUint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

function randomTailBytes(): Uint8Array {
  const tail = new Uint8Array(5);
  crypto.getRandomValues(tail);
  return tail;
}

function encodeTimestampSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

function formatUtcCompact(now: Date): string {
  return now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function toHexByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0");
}

function encodeStrategyBytes(strategy: string): Uint8Array {
  const bytes = new TextEncoder().encode(strategy.slice(0, 3).toUpperCase());
  const out = new Uint8Array(3);
  out.set(bytes.slice(0, 3));
  return out;
}

function writeUint32BE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, false);
}

/** Build 16-byte (128-bit) payload: [strategy×3][ts×4][nonce×4][random×5] */
export function buildCloidPayload(input: {
  strategy: string;
  timestampSec: number;
  nonce: number;
  tail?: Uint8Array;
}): Uint8Array {
  const payload = new Uint8Array(16);
  payload.set(encodeStrategyBytes(input.strategy), 0);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  writeUint32BE(view, 3, input.timestampSec);
  writeUint32BE(view, 7, input.nonce);
  payload.set(input.tail ?? randomTailBytes(), 11);
  return payload;
}

export function payloadToHex(payload: Uint8Array): string {
  return (
    CLOID_HEX_PREFIX +
    Array.from(payload, (b) => toHexByte(b)).join("")
  );
}

export function formatCloidTagged(input: {
  strategy: string;
  now: Date;
  nonce: number;
}): string {
  const prefix =
    input.strategy.toUpperCase() === CLOID_STRATEGY_PREFIX
      ? CLOID_TAGGED_PREFIX
      : `${input.strategy.toUpperCase()}-`;
  return `${prefix}${formatUtcCompact(input.now)}-${(input.nonce >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

/** Generate a Root 14 CLOID with embedded strategy, UTC timestamp, and nonce. */
export function generateCloid(input: CloidGenerateInput = {}): GeneratedCloid {
  const strategy = (input.strategy ?? CLOID_STRATEGY_PREFIX).toUpperCase();
  const now = input.now ?? new Date();
  const nonce = input.nonce ?? randomUint32();
  const timestampSec = encodeTimestampSeconds(now);
  const payload = buildCloidPayload({ strategy, timestampSec, nonce });
  const hex = payloadToHex(payload);
  const tagged = formatCloidTagged({ strategy, now, nonce });

  return {
    hex,
    tagged,
    strategy,
    utcTimestampMs: now.getTime(),
    nonce: nonce >>> 0,
  };
}

const CLOID_HEX_RE = /^0x[0-9a-f]{32}$/i;
const CLOID_TAGGED_RE = /^[A-Z0-9]{2,8}-\d{14}-[0-9a-f]{8}$/i;

/** Validate Hyperliquid-style 128-bit hex CLOID (0x + 32 hex chars). */
export function isValidCloidHex(cloid: string): boolean {
  return CLOID_HEX_RE.test(cloid.trim());
}

/** Validate human-readable tagged CLOID (STM-YYYYMMDDHHmmss-<nonce>). */
export function isValidCloidTagged(cloid: string): boolean {
  return CLOID_TAGGED_RE.test(cloid.trim());
}

export function parseCloidHex(hex: string): {
  strategy: string;
  timestampSec: number;
  nonce: number;
} | null {
  if (!isValidCloidHex(hex)) return null;
  const body = hex.trim().slice(2);
  const payload = new Uint8Array(
    body.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)),
  );
  const strategy = new TextDecoder().decode(payload.slice(0, 3)).replace(/\0/g, "");
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    strategy,
    timestampSec: view.getUint32(3, false),
    nonce: view.getUint32(7, false),
  };
}
