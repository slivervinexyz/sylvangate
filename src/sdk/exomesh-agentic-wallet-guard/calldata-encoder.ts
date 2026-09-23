/**
 * SPDX-License-Identifier: Apache-2.0
 * Calldata encoders for harness / tests — module-load scratch buffers (zero per-encode alloc).
 */

const ENCODE_68 = new Uint8Array(68);
const ENCODE_132 = new Uint8Array(132);
const ENCODE_260 = new Uint8Array(260);
const ENCODE_100 = new Uint8Array(100);

function bytesToHex(body: Uint8Array): string {
  let hex = "0x";
  for (let i = 0; i < body.length; i += 1) hex += body[i]!.toString(16).padStart(2, "0");
  return hex;
}

function writeAddrWord(body: Uint8Array, wordOff: number, hex: string): void {
  const raw = hex.toLowerCase().replace(/^0x/, "");
  const base = 4 + wordOff + 12;
  for (let i = 0; i < 20; i += 1) {
    body[base + i] = parseInt(raw.slice(i * 2, i * 2 + 2) || "00", 16);
  }
}

export function encodeApproveCalldata(spender: string, amountWei: bigint): string {
  const body = ENCODE_68;
  body.fill(0);
  body[0] = 0x09;
  body[1] = 0x5e;
  body[2] = 0xa7;
  body[3] = 0xb3;
  const spenderHex = spender.toLowerCase().replace(/^0x/, "");
  for (let i = 0; i < 20; i += 1) {
    const byte = parseInt(spenderHex.slice(i * 2, i * 2 + 2) || "00", 16);
    body[16 + i] = byte;
  }
  let amt = amountWei;
  for (let i = 67; i >= 36; i -= 1) {
    body[i] = Number(amt & 0xffn);
    amt >>= 8n;
  }
  return bytesToHex(body);
}

/** Encode Permit2 approve(address,address,uint160,uint48) for harness / tests. */
export function encodePermit2ApproveCalldata(
  token: string,
  spender: string,
  amountWei: bigint,
  expiration = 0,
): string {
  const body = ENCODE_132;
  body.fill(0);
  body[0] = 0x87;
  body[1] = 0x51;
  body[2] = 0x7c;
  body[3] = 0x45;
  writeAddrWord(body, 0, token);
  writeAddrWord(body, 32, spender);
  let amt = amountWei;
  for (let i = 99; i >= 80; i -= 1) {
    body[i] = Number(amt & 0xffn);
    amt >>= 8n;
  }
  let exp = BigInt(expiration);
  for (let i = 131; i >= 116; i -= 1) {
    body[i] = Number(exp & 0xffn);
    exp >>= 8n;
  }
  return bytesToHex(body);
}

/** Encode inlined Permit2 permit(address,PermitSingle,bytes) skeleton for tests. */
export function encodePermit2PermitCalldata(
  owner: string,
  token: string,
  spender: string,
  amountWei: bigint,
): string {
  const body = ENCODE_260;
  body.fill(0);
  body[0] = 0x2a;
  body[1] = 0x08;
  body[2] = 0x86;
  body[3] = 0xf7;
  writeAddrWord(body, 0, owner);
  writeAddrWord(body, 32, token);
  let amt = amountWei;
  for (let i = 99; i >= 80; i -= 1) {
    body[i] = Number(amt & 0xffn);
    amt >>= 8n;
  }
  writeAddrWord(body, 96, spender);
  body[228] = 0xc0;
  return bytesToHex(body);
}

/** Encode ERC-7540 requestDeposit(uint256,address,address) for harness / tests. */
export function encodeErc7540RequestDepositCalldata(
  assetsWei: bigint,
  controller: string,
  owner: string,
): string {
  const body = ENCODE_100;
  body.fill(0);
  body[0] = 0xb2;
  body[1] = 0xd9;
  body[2] = 0xf2;
  body[3] = 0x01;
  let amt = assetsWei;
  for (let i = 35; i >= 4; i -= 1) {
    body[i] = Number(amt & 0xffn);
    amt >>= 8n;
  }
  writeAddrWord(body, 32, controller);
  writeAddrWord(body, 64, owner);
  return bytesToHex(body);
}

/** Encode ERC-7540 setOperator(address,bool) for harness / tests. */
export function encodeErc7540SetOperatorCalldata(operator: string, approved: boolean): string {
  const body = ENCODE_68;
  body.fill(0);
  body[0] = 0x9c;
  body[1] = 0xc2;
  body[2] = 0x33;
  body[3] = 0xd6;
  writeAddrWord(body, 0, operator);
  body[67] = approved ? 1 : 0;
  return bytesToHex(body);
}
