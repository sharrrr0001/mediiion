import { z } from 'zod';

/** Indian mobile: 10 digits starting 6-9, optional +91 / 91 / 0 prefix. Normalised to +91XXXXXXXXXX. */
export const IndianPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'))
  .transform((v) => `+91${v}`);

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const OtpRequest = z.discriminatedUnion('channel', [
  z.object({ channel: z.literal('sms'), phone: IndianPhone }).strict(),
  z.object({ channel: z.literal('email'), email: Email }).strict(),
]);
export type OtpRequest = z.infer<typeof OtpRequest>;

export const OtpVerify = z
  .object({
    challengeId: z.uuid(),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  })
  .strict();
export type OtpVerify = z.infer<typeof OtpVerify>;

export const TwoFactorVerify = z
  .object({
    ticket: z.string().min(20).max(2000),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
  })
  .strict();
export type TwoFactorVerify = z.infer<typeof TwoFactorVerify>;

/** OTP verify response for roles that need 2FA (no session yet). */
export type TwoFactorChallengeResponse =
  | { twoFactor: 'verify'; ticket: string }
  | { twoFactor: 'setup'; ticket: string; secret: string; otpauthUrl: string };

/** Password rules: 8–128 chars, at least one letter and one number, not a very common password. */
export const PASSWORD_MIN = 8;
const COMMON = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123', 'iloveyou', 'abc12345', 'password123', '11111111', 'india123', 'welcome1', 'admin123']);
export const Password = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128, 'Too long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'This password is too common');

/** "I already have an account": email (or mobile) + password. */
export const PasswordLogin = z.union([
  z.object({ email: Email, password: z.string().min(1).max(128) }).strict(),
  z.object({ phone: IndianPhone, password: z.string().min(1).max(128) }).strict(),
]);
export type PasswordLogin = z.infer<typeof PasswordLogin>;

/** Set a password after an OTP login (first time) or change it (needs the current one). */
export const SetPassword = z
  .object({ password: Password, confirm: z.string(), currentPassword: z.string().max(128).optional() })
  .strict()
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
export type SetPassword = z.infer<typeof SetPassword>;

/** Forgot password: prove the email/phone with a fresh OTP and choose a new password. */
export const ResetPassword = z
  .object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/), password: Password, confirm: z.string() })
  .strict()
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
export type ResetPassword = z.infer<typeof ResetPassword>;
