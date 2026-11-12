import { z } from 'zod';
import { CONSENT_VERSION, LANGUAGES } from './constants';

export const Gender = z.enum(['female', 'male', 'other', 'prefer_not_to_say']);

/** First-time profile (spec §7.1 #2). Either dob or age is required. */
export const CreatePatientProfile = z
  .object({
    name: z.string().trim().min(1).max(100),
    dob: z.iso.date().optional(),
    age: z.number().int().min(0).max(120).optional(),
    gender: Gender,
    city: z.string().trim().min(1).max(80),
    language: z.enum(LANGUAGES),
  })
  .strict()
  .refine((v) => v.dob !== undefined || v.age !== undefined, {
    message: 'Enter date of birth or age',
    path: ['age'],
  });
export type CreatePatientProfile = z.infer<typeof CreatePatientProfile>;

export const GrantConsent = z
  .object({
    type: z.literal('data_processing'),
    version: z.literal(CONSENT_VERSION),
    agreed: z.literal(true),
  })
  .strict();
export type GrantConsent = z.infer<typeof GrantConsent>;

export interface ProfileSummary {
  id: string;
  medicosId: string;
  name: string;
  isPrimary: boolean;
  language: string;
}

/** Shape returned by GET /me. Only a masked contact hint, never the raw phone/email. */
export interface MeResponse {
  user: { id: string; role: string; contactHint: string };
  needsConsent: boolean;
  needsProfile: boolean;
  profiles: ProfileSummary[];
}
