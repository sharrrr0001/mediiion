import { describe, expect, it } from 'vitest';
import { IndianPhone, OtpRequest, OtpVerify } from './auth';
import { CreatePatientProfile } from './patient';

describe('auth schemas', () => {
  it.each(['9876543210', '+91 98765 43210', '09876543210', '919876543210'])('normalises %s', (input) => {
    expect(IndianPhone.parse(input)).toBe('+919876543210');
  });

  it.each(['12345', '5876543210', 'abcdefghij', '+1 9876543210', ''])('rejects %s', (input) => {
    expect(IndianPhone.safeParse(input).success).toBe(false);
  });

  it('lowercases emails and rejects bad ones', () => {
    expect(OtpRequest.parse({ channel: 'email', email: ' Rahul@Example.COM ' })).toEqual({
      channel: 'email',
      email: 'rahul@example.com',
    });
    expect(OtpRequest.safeParse({ channel: 'email', email: 'nope' }).success).toBe(false);
  });

  it('requires a 6-digit code', () => {
    const challengeId = '3f1c2b7e-9a4d-4c1e-8b2a-1d2e3f4a5b6c';
    expect(OtpVerify.safeParse({ challengeId, code: '123456' }).success).toBe(true);
    expect(OtpVerify.safeParse({ challengeId, code: '12345' }).success).toBe(false);
    expect(OtpVerify.safeParse({ challengeId, code: '12a456' }).success).toBe(false);
  });

  it('profile needs dob or age, and handles Devanagari names', () => {
    const base = { name: 'राहुल मेहता', gender: 'male', city: 'Indore', language: 'hi' } as const;
    expect(CreatePatientProfile.safeParse(base).success).toBe(false);
    expect(CreatePatientProfile.safeParse({ ...base, age: 28 }).success).toBe(true);
    expect(CreatePatientProfile.safeParse({ ...base, dob: '1998-03-14' }).success).toBe(true);
    expect(CreatePatientProfile.safeParse({ ...base, age: 28, name: 'x'.repeat(101) }).success).toBe(false);
  });
});
