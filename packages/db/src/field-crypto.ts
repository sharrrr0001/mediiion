import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Application-level field encryption for PHI (spec §11).
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url). `context` is bound as AAD so a ciphertext copied
 * into another column/row type fails to decrypt. Phase 6 swaps the raw key for KMS envelope keys
 * (new version prefix) without a schema change.
 */
export interface FieldCrypto {
  encrypt(plaintext: string, context: string): string;
  decrypt(ciphertext: string, context: string): string;
  /** Deterministic HMAC for exact-match lookup of phone/email (never reversible). */
  blindIndex(value: string, purpose: string): string;
  /** Constant-time comparison of two hex HMACs. */
  safeEqual(a: string, b: string): boolean;
}

function decodeKey(name: string, b64: string | undefined): Buffer {
  if (!b64) throw new Error(`${name} is not set`);
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
  return key;
}

export function createFieldCrypto(encKeyB64: string | undefined, indexKeyB64: string | undefined): FieldCrypto {
  const encKey = decodeKey('FIELD_ENCRYPTION_KEY', encKeyB64);
  const idxKey = decodeKey('BLIND_INDEX_KEY', indexKeyB64);
  if (encKey.equals(idxKey)) throw new Error('FIELD_ENCRYPTION_KEY and BLIND_INDEX_KEY must differ');

  return {
    encrypt(plaintext, context) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encKey, iv);
      cipher.setAAD(Buffer.from(context, 'utf8'));
      const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
    },
    decrypt(ciphertext, context) {
      const [version, iv, tag, ct] = ciphertext.split('.');
      if (version !== 'v1' || !iv || !tag || ct === undefined) throw new Error('Unsupported ciphertext format');
      const decipher = createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
    },
    blindIndex(value, purpose) {
      return createHmac('sha256', idxKey).update(`${purpose}:${value}`, 'utf8').digest('hex');
    },
    safeEqual(a, b) {
      const ba = Buffer.from(a, 'hex');
      const bb = Buffer.from(b, 'hex');
      return ba.length === bb.length && timingSafeEqual(ba, bb);
    },
  };
}

/** AAD contexts — one per encrypted column. */
export const ENC = {
  phone: 'user.phone',
  email: 'user.email',
  totp: 'user.totp',
  name: 'patient.name',
  dob: 'patient.dob',
  message: 'intake.message',
  summary: 'summary.json',
  note: 'doctor_note',
} as const;

/** Blind-index purposes. */
export const BIDX = { phone: 'phone', email: 'email', otp: 'otp', ip: 'ip', token: 'token' } as const;
