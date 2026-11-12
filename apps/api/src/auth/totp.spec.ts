import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotpSecret, hotp, totp, verifyTotp } from './totp';

// RFC 6238 Appendix B (SHA-1): secret "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('matches the RFC vector at t=%i', (t, expected) => {
    expect(totp(RFC_SECRET, t * 1000, 8)).toBe(expected);
  });

  it('matches RFC 4226 HOTP vectors', () => {
    const s = Buffer.from('12345678901234567890');
    expect([0, 1, 2, 3].map((c) => hotp(s, c))).toEqual(['755224', '287082', '359152', '969429']);
  });

  it('base32 round-trips', () => {
    const buf = Buffer.from('any random bytes here!');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('accepts ±1 step, rejects older codes and junk', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    expect(verifyTotp(secret, totp(secret, now), now)).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull();
    expect(verifyTotp(secret, '12345', now)).toBeNull();
  });
});
