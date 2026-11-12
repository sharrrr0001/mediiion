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
