import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238, HMAC-SHA1, 30 s, 6 digits) — compatible with Google Authenticator, Authy, Microsoft
 * Authenticator. Implemented on node:crypto and verified against the RFC test vectors (totp.spec.ts).
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const offset = h[h.length - 1]! & 0xf;
  const bin = ((h[offset]! & 0x7f) << 24) | (h[offset + 1]! << 16) | (h[offset + 2]! << 8) | h[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totp(secretB32: string, timeMs = Date.now(), digits = 6): string {
  return hotp(base32Decode(secretB32), Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS), digits);
}

/**
 * Checks `code` in a ±1 step window. Returns the matched time step (so callers can reject replays of
 * an already-used step) or null.
 */
export function verifyTotp(secretB32: string, code: string, timeMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
  const secret = base32Decode(secretB32);
  for (const s of [step - 1, step, step + 1]) {
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, Buffer.from(code))) return s;
  }
  return null;
}

export function otpauthUrl(secretB32: string, account: string, issuer = 'Medicos'): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
