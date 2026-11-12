import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createFieldCrypto } from './field-crypto';

const key = () => randomBytes(32).toString('base64');

describe('field crypto', () => {
  const c = createFieldCrypto(key(), key());

  it('round-trips unicode (Devanagari) text', () => {
    const ct = c.encrypt('राहुल मेहता — bukhar 101°F', 'patient.name');
    expect(ct.startsWith('v1.')).toBe(true);
    expect(ct).not.toContain('राहुल');
    expect(c.decrypt(ct, 'patient.name')).toBe('राहुल मेहता — bukhar 101°F');
  });

  it('uses a fresh IV each time', () => {
    expect(c.encrypt('same', 'x')).not.toBe(c.encrypt('same', 'x'));
  });

  it('fails when the ciphertext is moved to another column (AAD)', () => {
    const ct = c.encrypt('Rahul', 'patient.name');
    expect(() => c.decrypt(ct, 'intake.message')).toThrow();
  });

  it('fails on tampering and on the wrong key', () => {
    const ct = c.encrypt('Rahul', 'patient.name');
    const parts = ct.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => c.decrypt(parts.join('.'), 'patient.name')).toThrow();
    expect(() => createFieldCrypto(key(), key()).decrypt(ct, 'patient.name')).toThrow();
  });

  it('blind index is deterministic, keyed and purpose-separated', () => {
    expect(c.blindIndex('+919000000001', 'phone')).toBe(c.blindIndex('+919000000001', 'phone'));
    expect(c.blindIndex('+919000000001', 'phone')).not.toBe(c.blindIndex('+919000000001', 'email'));
    expect(createFieldCrypto(key(), key()).blindIndex('+919000000001', 'phone')).not.toBe(
      c.blindIndex('+919000000001', 'phone'),
    );
  });

  it('rejects bad keys', () => {
    expect(() => createFieldCrypto('short', key())).toThrow(/32 bytes/);
    const k = key();
    expect(() => createFieldCrypto(k, k)).toThrow(/differ/);
  });
});
